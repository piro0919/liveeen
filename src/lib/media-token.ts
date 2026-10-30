import { createHmac, timingSafeEqual } from 'node:crypto';

/** ブラウザからの配信に渡す札の有効な長さ。札は WHIP でつなぐときに一度だけ確かめられる */
const TOKEN_TTL_MINUTES = 10;
const MS_PER_MINUTE = 60_000;
export const MEDIA_TOKEN_TTL_MS = TOKEN_TTL_MINUTES * MS_PER_MINUTE;

function signature(secret: string, channelId: string, expiresAt: number): string {
  return createHmac('sha256', secret).update(`${channelId}.${expiresAt}`).digest('base64url');
}

/**
 * ブラウザからの配信に使う札（`<チャンネルの id>.<期限>.<署名>`）。
 * 配信の鍵は DB に SHA-256 でしか持たないので、ブラウザには渡せない。代わりに、ログインした配信者に
 * 期限付きの札をサーバーで作って渡し、MediaMTX の問い合わせ（src/lib/media-auth.ts）で確かめる
 */
export function signMediaToken(secret: string, channelId: string, now: number): string {
  const expiresAt = now + MEDIA_TOKEN_TTL_MS;
  return `${channelId}.${expiresAt}.${signature(secret, channelId, expiresAt)}`;
}

/** 札がそのチャンネルのもので、期限の内で、署名が合うか */
export function verifyMediaToken(
  secret: string,
  token: string,
  channelId: string,
  now: number,
): boolean {
  const [id, expires, sig, ...rest] = token.split('.');
  if (rest.length > 0 || id !== channelId || !expires || !sig) return false;
  const expiresAt = Number(expires);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < now) return false;
  const expected = Buffer.from(signature(secret, channelId, expiresAt));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
