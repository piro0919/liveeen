import { describe, expect, it } from 'vitest';
import { timeAgo } from '@/lib/time-ago';

const NOW = Date.UTC(2026, 10, 1);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('timeAgo', () => {
  it.each([
    [5 * MINUTE, '5分前'],
    [59 * MINUTE, '59分前'],
    [HOUR, '1時間前'],
    [23 * HOUR, '23時間前'],
    [DAY, '1日前'],
    [47 * HOUR, '1日前'],
    [29 * DAY, '29日前'],
    [30 * DAY, '1か月前'],
    [364 * DAY, '12か月前'],
    [365 * DAY, '1年前'],
    [800 * DAY, '2年前'],
  ])('%d ms ago reads as %s', (elapsed, expected) => {
    expect(timeAgo(NOW - elapsed, NOW)).toBe(expected);
  });

  it('never goes below one minute, also when the clocks disagree', () => {
    expect(timeAgo(NOW - 1000, NOW)).toBe('1分前');
    expect(timeAgo(NOW + HOUR, NOW)).toBe('1分前');
  });
});
