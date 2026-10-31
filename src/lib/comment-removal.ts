import type { RelayMessage } from './comment';
import { signRemoval } from './comment-token';

/** 中継が答えなければ、あきらめるまでの時間 */
const TIMEOUT_MS = 5000;

/**
 * 運営が消したコメントを、中継に知らせて全員の画面から消す（relay/relay.ts）。
 * 中継には札なしで、そのチャンネルにつなぎ、消す札を送って、受け取った知らせ（removed）を待ってから閉じる。
 * 知らせが来なければ投げる。古い中継は消す札を知らないので、消えたことにしない。
 * 中継は書く人のほかには口を開けていない（本番は Caddy が WebSocket だけを中継へ通す。deploy/Caddyfile）ので、見る人と同じ口を使う。
 * Node に組み込みの WebSocket を使う（ws を Next の関数に束ねると動かないことがあるため）
 */
export async function removeFromRelay(
  relayUrl: string,
  secret: string,
  channelId: string,
  commentId: string,
): Promise<void> {
  const token = signRemoval(secret, channelId, commentId, Date.now());
  const socket = new WebSocket(`${relayUrl}/${encodeURIComponent(channelId)}`);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('コメントの中継が答えません')), TIMEOUT_MS);
      const fail = (error: Error) => {
        clearTimeout(timer);
        reject(error);
      };
      socket.addEventListener('error', () => fail(new Error('コメントの中継につながりません')));
      socket.addEventListener('open', () => socket.send(JSON.stringify({ remove: token })));
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as RelayMessage;
        if (message.type === 'removed' && message.id === commentId) {
          clearTimeout(timer);
          resolve();
        } else if (message.type === 'error') {
          fail(new Error(`コメントの中継が断りました: ${message.message}`));
        }
      });
    });
  } finally {
    socket.close();
  }
}
