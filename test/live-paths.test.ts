import { describe, expect, it } from 'vitest';
import { liveFirst, livePathsOf, splitFollowed } from '@/lib/live-paths';

describe('liveFirst', () => {
  it('配信中の人を上にまとめ、それぞれの中の並びは変えない', () => {
    const channels = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    expect(liveFirst(channels, new Set(['d', 'b'])).map((channel) => channel.id)).toEqual([
      'b',
      'd',
      'a',
      'c',
    ]);
  });
});

function path(name: string, ready: boolean, readyTime: string | null) {
  return { name, ready, readyTime, confName: 'all_others', readers: [] };
}

describe('livePathsOf', () => {
  it('映像が届いている配信だけを、始まったのが新しい順に返す', () => {
    const body = {
      itemCount: 3,
      items: [
        path('old', true, '2026-10-30T10:00:00Z'),
        path('waiting', false, null),
        path('new', true, '2026-10-30T11:00:00Z'),
      ],
    };
    expect(livePathsOf(body)).toEqual([
      { channelId: 'new', startedAt: new Date('2026-10-30T11:00:00Z') },
      { channelId: 'old', startedAt: new Date('2026-10-30T10:00:00Z') },
    ]);
  });

  it('形の合わない応答は空の一覧にする', () => {
    expect(livePathsOf(null)).toEqual([]);
    expect(livePathsOf({ error: 'unauthorized' })).toEqual([]);
  });
});

describe('splitFollowed', () => {
  it('フォローしているものを分け、どちらも元の並びのままにする', () => {
    const at = new Date('2026-10-30T10:00:00Z');
    const live = ['a', 'b', 'c', 'd'].map((channelId) => ({ channelId, startedAt: at }));
    const { followed, others } = splitFollowed(live, new Set(['c', 'a', 'x']));
    expect(followed.map((channel) => channel.channelId)).toEqual(['a', 'c']);
    expect(others.map((channel) => channel.channelId)).toEqual(['b', 'd']);
  });
});
