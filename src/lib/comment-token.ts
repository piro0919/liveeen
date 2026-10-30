import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * コメントを書くための札の有効な長さ。札はコメントの中継につなぐときに一度だけ確かめられ、
 * つながっているあいだは切れない
 */
const TOKEN_TTL_MINUTES = 10;
const MS_PER_MINUTE = 60_000;
export const COMMENT_TOKEN_TTL_MS = TOKEN_TTL_MINUTES * MS_PER_MINUTE;

/** 札に入れるもの。名前は札を作った時点のもの */
export type Commenter = { userId: string; displayName: string };

type Payload = { c: string; u: string; n: string; e: number };

function signature(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
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
    e: now + COMMENT_TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${signature(secret, body)}`;
}

/**
 * 札がそのチャンネルのもので、期限の内で、署名が合えば書く人と札の期限を返す。合わなければ null。
 * 中継は書くたびに期限も見る。配信者が未ログインのコメントを止めたら、遅くとも期限で書けなくなる
 */
export function verifyCommentToken(
  secret: string,
  token: string,
  channelId: string,
  now: number,
): (Commenter & { expiresAt: number }) | null {
  const [body, sig, ...rest] = token.split('.');
  if (rest.length > 0 || !body || !sig) return null;
  const expected = Buffer.from(signature(secret, body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Payload;
  if (payload.c !== channelId || payload.e < now) return null;
  return { userId: payload.u, displayName: payload.n, expiresAt: payload.e };
}
