import { describe, expect, it } from 'vitest';
import { GLOBAL_ERROR_TEXTS } from '@/app/global-error-messages';
import ja from '../messages/ja.json';

/** 文言のファイルを、キーの道筋と値の組に平たくする */
function flatten(value: unknown, path: string[] = []): [string, unknown][] {
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => flatten(child, [...path, key]));
  }
  return [[path.join('.'), value]];
}

describe('messages/ja.json', () => {
  // global-error.tsx は ja.json を読まずに写しを持つので、食い違わないようにする
  it('外枠ごと落ちたときの文言が errorPage と同じ', () => {
    expect(GLOBAL_ERROR_TEXTS).toEqual(ja.errorPage);
  });

  // 書きかけの空の文言が画面にそのまま出ないようにする
  it('すべての文言が空でない文字列である', () => {
    const entries = flatten(ja);
    expect(entries.length).toBeGreaterThan(0);
    const bad = entries.filter(([, value]) => typeof value !== 'string' || value.trim() === '');
    expect(bad).toEqual([]);
  });
});
