import { describe, expect, it } from 'vitest';
import { DISPLAY_NAME_MAX, normalizeDisplayName } from '@/lib/display-name';

describe('normalizeDisplayName', () => {
  it('前後の空白を落として通す', () => {
    expect(normalizeDisplayName('  ぴろ ')).toEqual({ ok: true, name: 'ぴろ' });
  });

  it('空白だけは断る', () => {
    expect(normalizeDisplayName('   ').ok).toBe(false);
  });

  it('改行を含む名前は断る', () => {
    expect(normalizeDisplayName('ぴ\nろ').ok).toBe(false);
  });

  it('見た目の文字数で上限まで通し、超えたら断る', () => {
    const family = '👨‍👩‍👧';
    expect(normalizeDisplayName(family.repeat(DISPLAY_NAME_MAX)).ok).toBe(true);
    expect(normalizeDisplayName('あ'.repeat(DISPLAY_NAME_MAX + 1)).ok).toBe(false);
  });
});
