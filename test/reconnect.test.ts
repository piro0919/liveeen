import { describe, expect, it, vi } from 'vitest';
import { refusedForGood, retryUntil } from '@/lib/reconnect';
import { ScreenError } from '@/lib/screen-error';

const options = {
  deadline: Number.POSITIVE_INFINITY,
  waitMs: 0,
  cancelled: () => false,
  giveUp: () => false,
};

describe('refusedForGood', () => {
  it('はっきり断られたら、あきらめる', () => {
    expect(refusedForGood(new ScreenError('whipFailed', { status: 401 }))).toBe(true);
    expect(refusedForGood(new ScreenError('whipFailed', { status: 403 }))).toBe(true);
  });

  it('サーバーの不調や回線の失敗では、あきらめない', () => {
    expect(refusedForGood(new ScreenError('whipFailed', { status: 500 }))).toBe(false);
    expect(refusedForGood(new TypeError('Failed to fetch'))).toBe(false);
  });
});

describe('retryUntil', () => {
  it('失敗しても、取れるまで繰り返す', async () => {
    const attempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValue('ok');
    await expect(retryUntil(attempt, options)).resolves.toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('失敗しているうちに期限を過ぎたら、やめる', async () => {
    let time = 0;
    const attempt = vi.fn(() => {
      time = 1;
      return Promise.reject(new Error('x'));
    });
    await expect(
      retryUntil(attempt, { ...options, deadline: 1, now: () => time }),
    ).resolves.toBeNull();
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('期限を過ぎていたら、通る求めでも試さない（つながっては切れるのを終わらせる）', async () => {
    const attempt = vi.fn(() => Promise.resolve('ok'));
    await expect(
      retryUntil(attempt, { ...options, deadline: 0, now: () => 1 }),
    ).resolves.toBeNull();
    expect(attempt).not.toHaveBeenCalled();
  });

  it('あきらめる失敗が出たら、期限の前でもやめる', async () => {
    const attempt = vi.fn(() => Promise.reject(new Error('x')));
    await expect(retryUntil(attempt, { ...options, giveUp: () => true })).resolves.toBeNull();
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('やめる合図が出ていたら、試さない', async () => {
    const attempt = vi.fn(() => Promise.resolve('ok'));
    await expect(retryUntil(attempt, { ...options, cancelled: () => true })).resolves.toBeNull();
    expect(attempt).not.toHaveBeenCalled();
  });
});
