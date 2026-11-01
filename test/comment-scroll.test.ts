import { describe, expect, it } from 'vitest';
import { isNearBottom } from '@/lib/comment-scroll';

const list = (scrollTop: number) => ({ scrollTop, clientHeight: 300, scrollHeight: 1000 });

describe('isNearBottom', () => {
  it('一番下か、その近くなら読み終えている', () => {
    expect(isNearBottom(list(700))).toBe(true);
    expect(isNearBottom(list(652))).toBe(true);
  });

  it('上へ戻して読んでいるなら、読み終えていない', () => {
    expect(isNearBottom(list(651))).toBe(false);
    expect(isNearBottom(list(0))).toBe(false);
  });
});
