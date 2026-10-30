import { describe, expect, it } from 'vitest';
import { DELIST_THRESHOLD, streamKey, withoutDelisted } from '@/lib/delist';

const now = new Date('2026-10-31T10:00:00Z');
const earlier = new Date('2026-10-31T09:00:00Z');

describe('withoutDelisted', () => {
  it('通報した人がしきい値に届いた配信だけを除く', () => {
    const live = [
      { channelId: 'a', startedAt: now },
      { channelId: 'b', startedAt: now },
    ];
    const reporters = new Map([
      [streamKey(live[0]), DELIST_THRESHOLD],
      [streamKey(live[1]), DELIST_THRESHOLD - 1],
    ]);
    expect(withoutDelisted(live, reporters).map((c) => c.channelId)).toEqual(['b']);
  });

  it('前の配信への通報は、新しく始めた配信には数えない', () => {
    const live = [{ channelId: 'a', startedAt: now }];
    const reporters = new Map([[streamKey({ channelId: 'a', startedAt: earlier }), 10]]);
    expect(withoutDelisted(live, reporters)).toEqual(live);
  });
});
