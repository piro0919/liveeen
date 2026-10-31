import { startRelay } from './relay';
import { ffmpegCapture, startThumbnails } from './thumbnails';

/** 手元で動かすときの番号。サイトは NEXT_PUBLIC_COMMENT_RELAY_URL でここにつなぐ */
const DEFAULT_PORT = 8090;
/** 署名の鍵の長さの下限（src/env.ts と同じ） */
const SECRET_MIN = 32;
/** MediaMTX の API と HLS。本番も手元も、中継と同じ機械で動いている（deploy/compose.yaml、compose.yaml） */
const DEFAULT_MEDIA_API_URL = 'http://127.0.0.1:9997';
const DEFAULT_MEDIA_HLS_URL = 'http://127.0.0.1:8888';

/** コメントの中継を起こす。手元では `pnpm relay`。鍵はサイトと同じ COMMENT_TOKEN_SECRET */
const secret = process.env.COMMENT_TOKEN_SECRET;
if (!secret || secret.length < SECRET_MIN) {
  throw new Error(`COMMENT_TOKEN_SECRET を${SECRET_MIN}文字以上で入れてください`);
}
const port = Number(process.env.RELAY_PORT ?? DEFAULT_PORT);
const host = process.env.RELAY_HOST;
const thumbnails = startThumbnails({
  apiUrl: process.env.RELAY_MEDIA_API_URL ?? DEFAULT_MEDIA_API_URL,
  capture: ffmpegCapture(process.env.RELAY_MEDIA_HLS_URL ?? DEFAULT_MEDIA_HLS_URL),
});
const relay = startRelay({ port, host, secret, thumbnail: thumbnails.get });
void relay.listening.then(() =>
  console.log(`コメントの中継: ws://${host ?? 'localhost'}:${relay.port()}`),
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    thumbnails.stop();
    void relay.close().then(() => process.exit(0));
  });
}
