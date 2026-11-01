import { describe, expect, it } from 'vitest';
import { normalizeStreamTitle, STREAM_TITLE_MAX } from '@/lib/stream-title';

describe('normalizeStreamTitle', () => {
  it('前後の空白を落とし、改行は空白にして通す', () => {
    expect(normalizeStreamTitle('  雑談\nします ')).toEqual({ ok: true, title: '雑談 します' });
  });

  it('空ならタイトルを消す', () => {
    expect(normalizeStreamTitle('   ')).toEqual({ ok: true, title: null });
  });

  it('見た目の文字数で上限まで通し、超えたら断る', () => {
    const family = '👨‍👩‍👧';
    expect(normalizeStreamTitle(family.repeat(STREAM_TITLE_MAX)).ok).toBe(true);
    expect(normalizeStreamTitle('あ'.repeat(STREAM_TITLE_MAX + 1)).ok).toBe(false);
  });
});

describe('見えない文字', () => {
  it('取り除く', () => {
    expect(normalizeStreamTitle('雑​談‮')).toEqual({ ok: true, title: '雑談' });
  });

  it('見える文字が無ければ、タイトルなしにする', () => {
    expect(normalizeStreamTitle('‍ㅤ')).toEqual({ ok: true, title: null });
  });
});
