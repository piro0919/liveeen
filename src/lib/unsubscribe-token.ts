import { createHmac, timingSafeEqual } from 'node:crypto';

/** 署名の用途。ログインと同じ鍵を使うので、ほかの署名と取り違えないよう頭に付ける */
const PURPOSE = 'email-unsubscribe:';

function signature(secret: string, userId: string): string {
  return createHmac('sha256', secret)
    .update(PURPOSE + userId)
    .digest('base64url');
}

/**
 * メールを止めるための札（`<利用者の id を base64url>.<署名>`）。メールの List-Unsubscribe に入れ、
 * ログインしなくても1回押せば止まるようにする。期限は無い（古いメールから押しても止められるように）
 */
export function signUnsubscribeToken(secret: string, userId: string): string {
  return `${Buffer.from(userId).toString('base64url')}.${signature(secret, userId)}`;
}

/** 署名が合えば利用者の id を返す。合わなければ null */
export function verifyUnsubscribeToken(secret: string, token: string): string | null {
  const [body, sig, ...rest] = token.split('.');
  if (rest.length > 0 || !body || !sig) return null;
  const userId = Buffer.from(body, 'base64url').toString();
  const expected = Buffer.from(signature(secret, userId));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return userId;
}
