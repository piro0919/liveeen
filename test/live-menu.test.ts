import { describe, expect, it } from 'vitest';
import { liveMenuItems } from '@/lib/live-menu';

describe('liveMenuItems', () => {
  it('配信中はタイトル・コメントの管理・共有が並ぶ', () => {
    expect(liveMenuItems({ live: true, manyMicrophones: false, hasBgm: false })).toEqual([
      'title',
      'commentRules',
      'share',
    ]);
  });

  it('マイクが2つ以上あり曲の置き場所があれば、マイクと BGM が先に並ぶ', () => {
    expect(liveMenuItems({ live: true, manyMicrophones: true, hasBgm: true })).toEqual([
      'microphone',
      'bgm',
      'title',
      'commentRules',
      'share',
    ]);
  });

  it('練習では、見ている人に関わる項目を出さない', () => {
    expect(liveMenuItems({ live: false, manyMicrophones: true, hasBgm: true })).toEqual([
      'microphone',
      'bgm',
    ]);
  });

  it('練習でマイクが1つで曲も無ければ、空になる', () => {
    expect(liveMenuItems({ live: false, manyMicrophones: false, hasBgm: false })).toEqual([]);
  });
});
