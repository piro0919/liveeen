import { describe, expect, it } from 'vitest';
import { relayRetryMs } from '@/lib/relay-retry';

describe('relayRetryMs', () => {
  it('3秒から倍々に広げ、1分で止める', () => {
    const middle = () => 0.5;
    expect([0, 1, 2, 3, 4, 5, 6, 20].map((attempt) => relayRetryMs(attempt, middle))).toEqual([
      3000, 6000, 12_000, 24_000, 48_000, 60_000, 60_000, 60_000,
    ]);
  });

  it('全員がそろわないよう、前後に散らす', () => {
    expect(relayRetryMs(0, () => 0)).toBe(2250);
    expect(relayRetryMs(0, () => 1)).toBe(3750);
  });
});
