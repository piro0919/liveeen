import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import {
  BLOCKED,
  type Comment,
  isGuestId,
  normalizeComment,
  type RelayMessage,
  TOKEN_EXPIRED,
} from '../src/lib/comment';
import {
  type Author,
  COMMENT_TOKEN_TTL_MS,
  type Commenter,
  signAuthor,
  verifyAuthor,
  verifyCommentToken,
} from '../src/lib/comment-token';

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

type Writer = Commenter & { issuedAt: number; expiresAt: number };
/** 覚えておくコメント。書いた人は、ブロックされたときに消すために持つ */
type Entry = { comment: Comment; userId: string; ipKey: string | null; author: string };
/**
 * 配信者のブロック。止めた時刻より前に作られた札では書かせない。後の札はサイトが出さない（src/lib/blocks.ts）。
 * それより前の札は COMMENT_TOKEN_TTL_MS で切れるので、それだけ覚えておけばよい
 */
type Block = { userId: string; ipKey: string | null; at: number };
type Room = { clients: Map<WebSocket, Writer | null>; history: Entry[]; blocks: Block[] };

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

/** その人のコメントか。ログインした人は id で、IP の鍵があれば IP でも見る */
function sameAuthor(block: Block, userId: string, ipKey: string | null): boolean {
  return userId === block.userId || (block.ipKey !== null && ipKey === block.ipKey);
}

function blockedWriter(room: Room, writer: Writer, now: number): boolean {
  return room.blocks.some(
    (block) =>
      now - block.at < COMMENT_TOKEN_TTL_MS &&
      writer.issuedAt <= block.at &&
      sameAuthor(block, writer.userId, writer.ipKey),
  );
}

/** 見せるコメント。書いた人の札は配信者にだけ付ける */
function shown(entry: Entry, writer: Writer | null): Comment {
  return writer?.owner ? { ...entry.comment, author: entry.author } : entry.comment;
}

/** 届いた1通。書くコメントか、配信者のブロック */
function parseMessage(data: unknown): { text: string } | { block: string } | null {
  try {
    const parsed: unknown = JSON.parse(String(data));
    if (typeof parsed !== 'object' || parsed === null) return null;
    if ('block' in parsed && typeof parsed.block === 'string') return { block: parsed.block };
    if ('text' in parsed && typeof parsed.text === 'string') {
      const text = normalizeComment(parsed.text);
      return text ? { text } : null;
    }
  } catch {
    return null;
  }
  return null;
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

  /** 配信者がブロックした。その人のコメントを消し、つなぎを閉じる */
  function block(room: Room, author: Author, owner: Writer): void {
    const at = now();
    // 配信者と同じ回線の人を IP で止めると、配信者まで書けなくなるので、そのときは id だけで止める
    const ipKey = author.ipKey === owner.ipKey ? null : author.ipKey;
    const added: Block = { userId: author.userId, ipKey, at };
    room.blocks = [...room.blocks.filter((b) => at - b.at < COMMENT_TOKEN_TTL_MS), added];
    const removed = room.history.filter((entry) => sameAuthor(added, entry.userId, entry.ipKey));
    room.history = room.history.filter((entry) => !removed.includes(entry));
    const ids = removed.map((entry) => entry.comment.id);
    for (const [client, writer] of room.clients) {
      if (ids.length > 0) send(client, { type: 'remove', ids });
      if (writer && !writer.owner && blockedWriter(room, writer, at))
        client.close(BLOCKED, 'blocked');
    }
  }

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
      room = { clients: new Map(), history: [], blocks: [] };
      rooms.set(channelId, room);
    }
    const joined = room;
    // ブロックより前の札でつなぎ直してきた人は、読むだけにする
    const writer = commenter && !blockedWriter(joined, commenter, now()) ? commenter : null;
    joined.clients.set(socket, writer);
    alive.add(socket);
    send(socket, {
      type: 'history',
      comments: joined.history.map((entry) => shown(entry, writer)),
    });

    let lastPostAt = -Infinity;
    socket.on('pong', () => alive.add(socket));
    socket.on('message', (data) => {
      if (!writer) {
        send(socket, { type: 'error', message: 'コメントするにはログインしてください' });
        return;
      }
      const message = parseMessage(data);
      if (!message) return;
      if ('block' in message) {
        const author = verifyAuthor(secret, message.block, channelId);
        if (writer.owner && author && author.userId !== writer.userId) {
          block(joined, author, writer);
        }
        return;
      }
      const at = now();
      if (writer.expiresAt < at) {
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
      const entry: Entry = {
        comment: {
          id: randomUUID(),
          name: writer.displayName,
          text: message.text,
          at,
          guest: isGuestId(writer.userId),
        },
        userId: writer.userId,
        ipKey: writer.ipKey,
        author: signAuthor(secret, channelId, {
          userId: writer.userId,
          displayName: writer.displayName,
          ipKey: writer.ipKey,
        }),
      };
      joined.history = [...joined.history, entry].slice(-HISTORY_SIZE);
      for (const [client, viewer] of joined.clients) {
        send(client, { type: 'comment', comment: shown(entry, viewer) });
      }
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
