import { startRelay } from './relay';

/** 手元で動かすときの番号。サイトは NEXT_PUBLIC_COMMENT_RELAY_URL でここにつなぐ */
const DEFAULT_PORT = 8090;
/** 署名の鍵の長さの下限（src/env.ts と同じ） */
const SECRET_MIN = 32;

/** コメントの中継を起こす。手元では `pnpm relay`。鍵はサイトと同じ COMMENT_TOKEN_SECRET */
const secret = process.env.COMMENT_TOKEN_SECRET;
if (!secret || secret.length < SECRET_MIN) {
  throw new Error(`COMMENT_TOKEN_SECRET を${SECRET_MIN}文字以上で入れてください`);
}
const port = Number(process.env.RELAY_PORT ?? DEFAULT_PORT);
const host = process.env.RELAY_HOST;
const relay = startRelay({ port, host, secret });
void relay.listening.then(() =>
  console.log(`コメントの中継: ws://${host ?? 'localhost'}:${relay.port()}`),
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void relay.close().then(() => process.exit(0)));
}
