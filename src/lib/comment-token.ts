import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Comment } from './comment';

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

/** 中継が流したそのままのコメントか。コメントの中身から作る署名で、書いた人は入れない（見る人に id を見せないため） */
type Shown = Pick<Comment, 'id' | 'name' | 'text' | 'at' | 'guest'>;

/** 札と取り違えないための印 */
const PROOF_MARK = 'proof';

function proofBody(channelId: string, comment: Shown): string {
  return JSON.stringify([
    PROOF_MARK,
    channelId,
    comment.id,
    comment.name,
    comment.text,
    comment.at,
    comment.guest,
  ]);
}

/**
 * コメントの印（中継が作り、コメントに付けて全員に流す）。通報するときに見る画面がサイトへ送り返し、
 * サイトは中身が中継の流したものと同じかを確かめてから保存する。見る人が本文や名前を書き換えて通報することはできない
 */
export function signCommentProof(secret: string, channelId: string, comment: Shown): string {
  return signature(secret, proofBody(channelId, comment));
}

export function verifyCommentProof(
  secret: string,
  channelId: string,
  comment: Shown,
  proof: string,
): boolean {
  const expected = Buffer.from(signCommentProof(secret, channelId, comment));
  const given = Buffer.from(proof);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** コメントを消す札の有効な長さ。サイトが作ってすぐ中継へ送る */
const REMOVAL_TTL_MS = MS_PER_MINUTE;
const REMOVAL_MARK = 'remove';

type RemovalPayload = { a: string; c: string; id: string; e: number };

/** 運営がコメントを消す札（サイトが作り、中継へ送る）。そのチャンネルのそのコメントにだけ効く */
export function signRemoval(secret: string, channelId: string, commentId: string, now: number) {
  const payload: RemovalPayload = {
    a: REMOVAL_MARK,
    c: channelId,
    id: commentId,
    e: now + REMOVAL_TTL_MS,
  };
  return sign(secret, payload);
}

/** 消す札がそのチャンネルのもので、期限の内で、署名が合えば消すコメントの id を返す。合わなければ null */
export function verifyRemoval(
  secret: string,
  token: string,
  channelId: string,
  now: number,
): string | null {
  const payload = open(secret, token) as RemovalPayload | null;
  if (!payload || payload.a !== REMOVAL_MARK || payload.c !== channelId || payload.e < now) {
    return null;
  }
  return payload.id;
}
