import { describe, expect, it } from 'vitest';
import { likePattern, normalizeSearchQuery } from '@/lib/search';

describe('normalizeSearchQuery', () => {
  it('前後の空白を落とす', () => {
    expect(normalizeSearchQuery('  ぴろ ')).toBe('ぴろ');
  });

  it('空白だけや文字列でないものは、探さない', () => {
    expect(normalizeSearchQuery('   ')).toBeNull();
    expect(normalizeSearchQuery(undefined)).toBeNull();
    expect(normalizeSearchQuery(['a'])).toBeNull();
  });

  it('NUL は Postgres に渡せないので落とす', () => {
    expect(normalizeSearchQuery('a\0b')).toBe('ab');
    expect(normalizeSearchQuery('\0')).toBeNull();
  });

  it('長すぎる分は切る', () => {
    expect(normalizeSearchQuery('あ'.repeat(101))).toHaveLength(100);
  });
});

describe('likePattern', () => {
  it('含むものを探す形にする', () => {
    expect(likePattern('piro')).toBe('%piro%');
  });

  it('% と _ と \\ は文字として探す', () => {
    expect(likePattern('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
  });
});
