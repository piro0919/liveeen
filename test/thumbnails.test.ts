import { describe, expect, it } from 'vitest';
import { startThumbnails } from '../relay/thumbnails';
import { thumbnailUrl } from '@/lib/thumbnail';

function pathList(names: string[]) {
  return {
    items: names.map((name) => ({ name, ready: true, readyTime: '2026-10-31T10:00:00Z' })),
  };
}

/** 呼ばれるたびに次の一覧を返す、配信サーバーの API の代わり */
function api(...lists: (string[] | null)[]): typeof fetch {
  let call = 0;
  return () => {
    const list = lists[Math.min(call++, lists.length - 1)];
    return Promise.resolve(
      list ? Response.json(pathList(list)) : new Response(null, { status: 503 }),
    );
  };
}

describe('startThumbnails', () => {
  it('配信中のチャンネルを1枚ずつ撮り、撮れなかったものは持たない', async () => {
    const captured: string[] = [];
    const thumbnails = startThumbnails({
      apiUrl: 'http://media',
      fetch: api(['a', 'b']),
      capture: (id) => {
        captured.push(id);
        return Promise.resolve(id === 'a' ? Buffer.from('a') : null);
      },
      intervalMs: 60_000,
    });
    await thumbnails.firstRound;
    thumbnails.stop();
    expect(captured).toEqual(['a', 'b']);
    expect(thumbnails.get('a')).toEqual(Buffer.from('a'));
    expect(thumbnails.get('b')).toBeUndefined();
  });

  it('終わった配信の画像は捨て、配信サーバーが答えないときは持っている画像を残す', async () => {
    const thumbnails = startThumbnails({
      apiUrl: 'http://media',
      fetch: api(['a', 'b'], null, ['b']),
      capture: (id) => Promise.resolve(Buffer.from(id)),
      intervalMs: 60_000,
    });
    await thumbnails.firstRound;
    expect(thumbnails.get('a')).toEqual(Buffer.from('a'));
    await thumbnails.round();
    // 2巡目は答えがなかったので、どちらも残る
    expect(thumbnails.get('a')).toEqual(Buffer.from('a'));
    await thumbnails.round();
    thumbnails.stop();
    expect(thumbnails.get('a')).toBeUndefined();
    expect(thumbnails.get('b')).toEqual(Buffer.from('b'));
  });
});

describe('thumbnailUrl', () => {
  it('中継の住所を http に読み替え、撮り直しの間隔ごとに変わる印を付ける', () => {
    expect(thumbnailUrl('wss://media.liveeen.kkweb.io', 'abc_-1', 120_000)).toBe(
      'https://media.liveeen.kkweb.io/thumbnails/abc_-1.jpg?v=2',
    );
    expect(thumbnailUrl('ws://localhost:8090', 'abc', 119_999)).toBe(
      'http://localhost:8090/thumbnails/abc.jpg?v=1',
    );
  });
});
