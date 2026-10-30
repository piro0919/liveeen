import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import {
  type Comment,
  normalizeComment,
  type RelayMessage,
  TOKEN_EXPIRED,
} from '../src/lib/comment';
import { verifyCommentToken } from '../src/lib/comment-token';

/** つないだ人に最初に見せる、それまでのコメントの数 */
const HISTORY_SIZE = 50;
/** 1つのつなぎから続けて書ける間隔。連投で流れを埋めさせない */
const POST_INTERVAL_MS = 1000;
/** 届いた1通の大きさの上限。コメントの上限（src/lib/comment.ts）より十分大きい */
const MAX_PAYLOAD_BYTES = 4096;
/** 切れたつなぎを見つけるために、生きているか聞く間隔 */
const PING_INTERVAL_MS = 30_000;
/** 配信の名前として受け付ける形（src/lib/media-auth.ts と同じ） */
const CHANNEL_PATTERN = /^\/([A-Za-z0-9_-]+)$/;
type Room = { clients: Set<WebSocket>; history: Comment[] };

type Options = {
  port: number;
  /** 待ち受ける住所。本番は Caddy だけが中継につなぐので 127.0.0.1（deploy/compose.yaml）。無ければすべて */
  host?: string;
  /** コメントの札の署名の鍵（src/lib/comment-token.ts） */
  secret: string;
  now?: () => number;
};

function send(socket: WebSocket, message: RelayMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

/**
 * コメントの中継。配信サーバーと同じ Akamai のサーバーで動かす（Vercel の関数は長くつなぎっぱなしにできない。CLAUDE.md）。
 * `ws://…/<チャンネルの id>?token=<札>` でつなぐ。札が無ければ読むだけ。
 * コメントは保存しない。チャンネルごとに直近のものだけを覚えておき、あとから来た人に見せる
 */
export function startRelay({ port, host, secret, now = Date.now }: Options) {
  const rooms = new Map<string, Room>();
  const server = new WebSocketServer({ port, host, maxPayload: MAX_PAYLOAD_BYTES });
  const alive = new WeakSet<WebSocket>();

  server.on('connection', (socket, request) => {
    const url = new URL(request.url ?? '/', 'ws://relay');
    const channelId = CHANNEL_PATTERN.exec(url.pathname)?.[1];
    if (!channelId) {
      socket.close(1008, 'channel');
      return;
    }
    const token = url.searchParams.get('token');
    const commenter = token ? verifyCommentToken(secret, token, channelId, now()) : null;

    let room = rooms.get(channelId);
    if (!room) {
      room = { clients: new Set(), history: [] };
      rooms.set(channelId, room);
    }
    const joined = room;
    joined.clients.add(socket);
    alive.add(socket);
    send(socket, { type: 'history', comments: joined.history });

    let lastPostAt = -Infinity;
    socket.on('pong', () => alive.add(socket));
    socket.on('message', (data) => {
      if (!commenter) {
        send(socket, { type: 'error', message: 'コメントするにはログインしてください' });
        return;
      }
      let text: string | null = null;
      try {
        const parsed: unknown = JSON.parse(String(data));
        if (typeof parsed === 'object' && parsed !== null && 'text' in parsed) {
          text = typeof parsed.text === 'string' ? normalizeComment(parsed.text) : null;
        }
      } catch {
        text = null;
      }
      if (!text) return;
      const at = now();
      if (commenter.expiresAt < at) {
        // 見る画面は閉じられたらすぐ新しい札でつなぎ直す（src/components/comments.tsx）
        send(socket, { type: 'error', message: '時間が空いたので、もう一度送ってください' });
        socket.close(TOKEN_EXPIRED, 'token expired');
        return;
      }
      if (at - lastPostAt < POST_INTERVAL_MS) {
        send(socket, { type: 'error', message: '少し待ってから書いてください' });
        return;
      }
      lastPostAt = at;
      const comment: Comment = { id: randomUUID(), name: commenter.displayName, text, at };
      joined.history = [...joined.history, comment].slice(-HISTORY_SIZE);
      for (const client of joined.clients) send(client, { type: 'comment', comment });
    });
    socket.on('close', () => {
      joined.clients.delete(socket);
      // 誰もいなくなっても、すぐには消さない。配信の途中でつなぎ直した人に流れを見せるため。
      // 配信が終わった部屋が残り続けるので、覚えておく数は HISTORY_SIZE で抑えている
    });
  });

  const ping = setInterval(() => {
    for (const socket of server.clients) {
      if (!alive.has(socket)) {
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      socket.ping();
    }
  }, PING_INTERVAL_MS);

  return {
    /** 待ち受けを始めたら解ける。住所（host）を渡すと、待ち受けは後から始まる */
    listening: new Promise<void>((resolve) => server.once('listening', () => resolve())),
    /** 実際に開いた番号。0 を渡したときに空いている番号が入る */
    port: () => (server.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(ping);
        for (const socket of server.clients) socket.terminate();
        server.close(() => resolve());
      }),
  };
}
