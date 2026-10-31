/** 縮小画像を撮り直す間隔（relay/thumbnails.ts）。住所に入れて、撮り直した画像を見せる */
const CAPTURE_INTERVAL_MS = 60_000;

/**
 * 配信の縮小画像の住所。画像はコメントの中継が返す（relay/relay.ts）ので、中継の住所の ws を http に読み替える。
 * 末尾の v は撮り直しの間隔ごとに変わり、見る人の手元の古い画像を使わせない。トップは開くたびに作る（connection）ので、いまの時刻で決める
 */
export function thumbnailUrl(relayUrl: string, channelId: string, now = Date.now()): string {
  const url = new URL(`/thumbnails/${encodeURIComponent(channelId)}.jpg`, relayUrl);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.searchParams.set('v', String(Math.floor(now / CAPTURE_INTERVAL_MS)));
  return url.href;
}
