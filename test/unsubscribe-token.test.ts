import { describe, expect, it } from 'vitest';
import { signUnsubscribeToken, verifyUnsubscribeToken } from '@/lib/unsubscribe-token';

const SECRET = 'x'.repeat(32);

describe('unsubscribe-token', () => {
  it('作った札から利用者の id が戻る', () => {
    expect(verifyUnsubscribeToken(SECRET, signUnsubscribeToken(SECRET, 'user-1'))).toBe('user-1');
  });

  it('別の鍵で作った札は通さない', () => {
    expect(verifyUnsubscribeToken(SECRET, signUnsubscribeToken('y'.repeat(32), 'user-1'))).toBe(
      null,
    );
  });

  it('id を書き換えた札は通さない', () => {
    const [, sig] = signUnsubscribeToken(SECRET, 'user-1').split('.');
    const forged = `${Buffer.from('user-2').toString('base64url')}.${sig}`;
    expect(verifyUnsubscribeToken(SECRET, forged)).toBe(null);
  });

  it('形の違う札は通さない', () => {
    expect(verifyUnsubscribeToken(SECRET, '')).toBe(null);
    expect(verifyUnsubscribeToken(SECRET, 'a.b.c')).toBe(null);
  });
});
