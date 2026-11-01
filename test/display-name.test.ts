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

describe('見えない文字', () => {
  it.each([
    ['ゼロ幅の空白', 'a​b'],
    ['向きを変える印', 'a‮b'],
    ['ゼロ幅の空白だけ', '​'],
  ])('%s は使えない', (_, name) => {
    expect(normalizeDisplayName(name)).toEqual({ ok: false, error: 'control' });
  });

  it.each([
    ['結合の印だけ', '‍'],
    ['ハングルの埋め草', 'ㅤ'],
    ['点字の空白', '⠀⠀'],
  ])('%s の名前は空として断る', (_, name) => {
    expect(normalizeDisplayName(name)).toEqual({ ok: false, error: 'empty' });
  });

  it('絵文字の組み合わせと旗は使える', () => {
    const family = '👨‍👩‍👧';
    const england = '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
    expect(normalizeDisplayName(family)).toEqual({ ok: true, name: family });
    expect(normalizeDisplayName(england)).toEqual({ ok: true, name: england });
  });
});
