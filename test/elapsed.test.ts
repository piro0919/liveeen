import { describe, expect, it } from 'vitest';
import { formatElapsed } from '@/lib/elapsed';

describe('formatElapsed', () => {
  it('1時間までは分と秒', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65_999)).toBe('1:05');
    expect(formatElapsed(3_599_000)).toBe('59:59');
  });

  it('1時間からは時も出す', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
    expect(formatElapsed(3_723_000)).toBe('1:02:03');
  });

  it('時計のずれで負になっても 0 にする', () => {
    expect(formatElapsed(-5000)).toBe('0:00');
  });
});
