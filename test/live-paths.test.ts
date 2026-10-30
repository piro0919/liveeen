import { describe, expect, it } from 'vitest';
import { livePathsOf } from '@/lib/live-paths';

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
