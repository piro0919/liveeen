import { describe, expect, it } from 'vitest';
import {
  BLOCKED_WORD_LENGTH_MAX,
  BLOCKED_WORDS_MAX,
  followerMayWrite,
  hasBlockedWord,
  NO_RULES,
  parseBlockedWords,
} from '@/lib/comment-settings';

describe('parseBlockedWords', () => {
  it('1行に1つずつ読み、空の行と重なりを落とし、全角と大文字をそろえる', () => {
    expect(parseBlockedWords('ばか\n\n  ＡＢＣ \nabc\r\nばか')).toEqual({
      ok: true,
      words: ['ばか', 'abc'],
    });
  });

  it('多すぎる・長すぎるときは断る', () => {
    const many = Array.from({ length: BLOCKED_WORDS_MAX + 1 }, (_, i) => `w${i}`).join('\n');
    expect(parseBlockedWords(many).ok).toBe(false);
    expect(parseBlockedWords('あ'.repeat(BLOCKED_WORD_LENGTH_MAX)).ok).toBe(true);
    expect(parseBlockedWords('あ'.repeat(BLOCKED_WORD_LENGTH_MAX + 1)).ok).toBe(false);
  });
});

describe('hasBlockedWord', () => {
  it('全角と大文字も同じに見て、含んでいれば当たる', () => {
    expect(hasBlockedWord('ＢＡＫＡだね', ['baka'])).toBe(true);
    expect(hasBlockedWord('こんにちは', ['baka'])).toBe(false);
    expect(hasBlockedWord('なんでも', [])).toBe(false);
  });
});

describe('followerMayWrite', () => {
  const now = 1_800_000_000_000;

  it('フォロワー限定でなければ誰でも書ける', () => {
    expect(followerMayWrite(NO_RULES, null, now)).toBe(true);
  });

  it('フォローして決めた分数がたった人だけ書ける', () => {
    const settings = { ...NO_RULES, followersOnlyMinutes: 10 };
    expect(followerMayWrite(settings, null, now)).toBe(false);
    expect(followerMayWrite(settings, now - 9 * 60_000, now)).toBe(false);
    expect(followerMayWrite(settings, now - 10 * 60_000, now)).toBe(true);
    expect(followerMayWrite({ ...NO_RULES, followersOnlyMinutes: 0 }, now, now)).toBe(true);
  });
});
