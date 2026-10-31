import { WebSocket } from 'ws';
import type { RelayMessage } from './comment';
import { type RelayCommand, signRelayCommand, signRemoval } from './comment-token';

/** 中継が答えなければ、あきらめるまでの時間 */
const TIMEOUT_MS = 5000;

/**
 * サイトのサーバーから中継へ1通送り、受け取った知らせを待ってから閉じる。知らせが来なければ投げる。
 * 中継には札なしで、そのチャンネルにつなぐ。
 * 中継は書く人のほかには口を開けていない（本番は Caddy が WebSocket だけを中継へ通す。deploy/Caddyfile）ので、見る人と同じ口を使う。
 * Node に組み込みの WebSocket は `Connection: upgrade` を小文字で送り、Caddy の振り分け（大文字小文字を見分ける）に乗らないので、ws を使う。
 * ws は Next に束ねさせない（next.config.ts の serverExternalPackages）
 */
async function sendToRelay(
  relayUrl: string,
  channelId: string,
  message: object,
  done: (reply: RelayMessage) => boolean,
): Promise<void> {
  const socket = new WebSocket(`${relayUrl}/${encodeURIComponent(channelId)}`);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('コメントの中継が答えません')), TIMEOUT_MS);
      const fail = (error: Error) => {
        clearTimeout(timer);
        reject(error);
      };
      socket.on('error', fail);
      socket.on('open', () => socket.send(JSON.stringify(message)));
      socket.on('message', (data) => {
        const reply = JSON.parse(String(data)) as RelayMessage;
        if (done(reply)) {
          clearTimeout(timer);
          resolve();
        } else if (reply.type === 'error') {
          fail(new Error(`コメントの中継が断りました: ${reply.message}`));
        }
      });
    });
  } finally {
    socket.close();
  }
}

/**
 * 運営が消したコメントを、中継に知らせて全員の画面から消す（relay/relay.ts）。
 * 古い中継は消す札を知らないので、消えたことにしない（知らせが来なければ投げる）
 */
export async function removeFromRelay(
  relayUrl: string,
  secret: string,
  channelId: string,
  commentId: string,
): Promise<void> {
  const token = signRemoval(secret, channelId, commentId, Date.now());
  await sendToRelay(
    relayUrl,
    channelId,
    { remove: token },
    (reply) => reply.type === 'removed' && reply.id === commentId,
  );
}

/**
 * コメントの決まりを変えたことや、モデレーターが変わったことを中継に知らせ、その場で効かせる（relay/relay.ts）。
 * 届かなくても、決まりは次に札をもらった人から効き、モデレーターは次につなぎ直したときから変わる
 */
export async function commandRelay(
  relayUrl: string,
  secret: string,
  channelId: string,
  command: RelayCommand,
): Promise<void> {
  const token = signRelayCommand(secret, channelId, command, Date.now());
  await sendToRelay(relayUrl, channelId, { command: token }, (reply) => reply.type === 'applied');
}
