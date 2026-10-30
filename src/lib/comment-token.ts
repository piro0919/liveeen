import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * コメントを書くための札の有効な長さ。札はコメントの中継につなぐときに一度だけ確かめられ、
 * つながっているあいだは切れない
 */
const TOKEN_TTL_MINUTES = 10;
const MS_PER_MINUTE = 60_000;
export const COMMENT_TOKEN_TTL_MS = TOKEN_TTL_MINUTES * MS_PER_MINUTE;

/**
 * 札に入れるもの。名前は札を作った時点のもの。
 * ipKey はブロックに使う IP の鍵（src/lib/ip-key.ts）で、分からなければ null。
 * owner はそのチャンネルの配信者で、コメントした人をブロックできる
 */
export type Commenter = {
  userId: string;
  displayName: string;
  ipKey: string | null;
  owner: boolean;
};

/**
 * コメントを書いた人。中継がコメントに付けて配信者にだけ渡し、配信者がブロックするときにサイトへ送り返す。
 * 署名してあるので、配信者が中身を書き換えてほかの人を止めることはできない
 */
export type Author = { userId: string; displayName: string; ipKey: string | null };

type Payload = { c: string; u: string; n: string; i: string | null; o: boolean; e: number };
type AuthorPayload = { a: string; c: string; u: string; n: string; i: string | null };

function signature(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function sign(secret: string, payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${signature(secret, body)}`;
}

/** 署名が合えば中身を返す。合わなければ null */
function open(secret: string, token: string): unknown {
  const [body, sig, ...rest] = token.split('.');
  if (rest.length > 0 || !body || !sig) return null;
  const expected = Buffer.from(signature(secret, body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return JSON.parse(Buffer.from(body, 'base64url').toString()) as unknown;
}

/**
 * コメントを書くための札（`<中身>.<署名>`）。中継（relay/）はサイトの DB もログインも持たないので、
 * ログインして名前を付けた人にサイトが札を作って渡し、中継は署名だけを確かめる
 */
export function signCommentToken(
  secret: string,
  channelId: string,
  commenter: Commenter,
  now: number,
): string {
  const payload: Payload = {
    c: channelId,
    u: commenter.userId,
    n: commenter.displayName,
    i: commenter.ipKey,
    o: commenter.owner,
    e: now + COMMENT_TOKEN_TTL_MS,
  };
  return sign(secret, payload);
}

/**
 * 札がそのチャンネルのもので、期限の内で、署名が合えば書く人と札の作られた時刻・期限を返す。合わなければ null。
 * 中継は書くたびに期限も見る。配信者が未ログインのコメントを止めたら、遅くとも期限で書けなくなる
 */
export function verifyCommentToken(
  secret: string,
  token: string,
  channelId: string,
  now: number,
): (Commenter & { issuedAt: number; expiresAt: number }) | null {
  const payload = open(secret, token) as Payload | null;
  if (!payload || payload.c !== channelId || payload.e < now) return null;
  return {
    userId: payload.u,
    displayName: payload.n,
    ipKey: payload.i ?? null,
    owner: payload.o === true,
    issuedAt: payload.e - COMMENT_TOKEN_TTL_MS,
    expiresAt: payload.e,
  };
}

/** 札と取り違えないための印 */
const AUTHOR_MARK = 'author';

/** コメントを書いた人の札（中継が作る）。そのチャンネルでだけ使える */
export function signAuthor(secret: string, channelId: string, author: Author): string {
  const payload: AuthorPayload = {
    a: AUTHOR_MARK,
    c: channelId,
    u: author.userId,
    n: author.displayName,
    i: author.ipKey,
  };
  return sign(secret, payload);
}

/** 書いた人の札が、そのチャンネルのもので署名が合えば中身を返す。合わなければ null */
export function verifyAuthor(secret: string, token: string, channelId: string): Author | null {
  const payload = open(secret, token) as AuthorPayload | null;
  if (!payload || payload.a !== AUTHOR_MARK || payload.c !== channelId) return null;
  return { userId: payload.u, displayName: payload.n, ipKey: payload.i ?? null };
}
