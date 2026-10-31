import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import {
  BLOCKED,
  type Comment,
  isGuestId,
  normalizeComment,
  type RelayMessage,
  ROLE_CHANGED,
  TOKEN_EXPIRED,
} from '../src/lib/comment';
import {
  type CommentSettings,
  followerMayWrite,
  followersOnlyMessage,
  hasBlockedWord,
  NO_RULES,
} from '../src/lib/comment-settings';
import {
  type Author,
  COMMENT_TOKEN_TTL_MS,
  type RelayCommand,
  signAuthor,
  signCommentProof,
  type VerifiedCommenter,
  verifyAuthor,
  verifyCommentToken,
  verifyRelayCommand,
  verifyRemoval,
} from '../src/lib/comment-token';

/** つないだ人に最初に見せる、それまでのコメントの数 */
const HISTORY_SIZE = 50;
/** 1つのつなぎから続けて書ける間隔。連投で流れを埋めさせない */
const POST_INTERVAL_MS = 1000;
/** 届いた1通の大きさの上限。コメントの上限（src/lib/comment.ts）と、禁止語を入れた指示の札（src/lib/comment-settings.ts）より十分大きい */
const MAX_PAYLOAD_BYTES = 16_384;
/** 切れたつなぎを見つけるために、生きているか聞く間隔 */
const PING_INTERVAL_MS = 30_000;
/** 配信の名前として受け付ける形（src/lib/media-auth.ts と同じ） */
const CHANNEL_PATTERN = /^\/([A-Za-z0-9_-]+)$/;
/** 配信の縮小画像の住所（relay/thumbnails.ts）。`/thumbnails/<チャンネルの id>.jpg` */
const THUMBNAIL_PATTERN = /^\/thumbnails\/([A-Za-z0-9_-]+)\.jpg$/;
/** 縮小画像を見る人の手元に置いてよい時間。撮り直しの間隔（relay/thumbnails.ts）より短く */
const THUMBNAIL_MAX_AGE_S = 30;
/** チャンネルごとの見ている人の数を返す住所 */
const VIEWERS_PATH = '/viewers';

type Writer = VerifiedCommenter;
/** 覚えておくコメント。書いた人は、ブロックされたときに消すために持つ。privileged は配信者かモデレーターが書いたもの */
type Entry = {
  comment: Comment;
  userId: string;
  ipKey: string | null;
  author: string;
  privileged: boolean;
};
/**
 * 配信者のブロック。止めた時刻より前に作られた札では書かせない。後の札はサイトが出さない（src/lib/blocks.ts）。
 * それより前の札は COMMENT_TOKEN_TTL_MS で切れるので、それだけ覚えておけばよい
 */
type Block = { userId: string; ipKey: string | null; at: number };
type Room = {
  clients: Map<WebSocket, Writer | null>;
  history: Entry[];
  blocks: Block[];
  /** 見ている人の数を流すまでの待ち。出入りが続いても、まとめて1度だけ流す */
  viewersTimer?: ReturnType<typeof setTimeout>;
  /** コメントの決まり。サイトからの指示か、つないできた人の札のうち新しいほうを使う */
  settings: CommentSettings;
  /** 配信者がつないだときの IP の鍵。モデレーターのブロックで、配信者と同じ回線の人を IP で止めないために使う */
  ownerIpKey: string | null;
  /**
   * モデレーターになった・外れた人と、その時刻（サイトの時計）。それより前に作られた札では書かせない。
   * 外れた人が前の札でつなぎ直して、モデレーターのまま振る舞うのを止める。札の期限（COMMENT_TOKEN_TTL_MS）が過ぎれば要らない
   */
  roleChanges: Map<string, number>;
  /** 人ごとの最後に書いた時刻。低速モードと連投の間隔を、つなぎごとでなく人ごとに数える（タブを増やしても抜けられない） */
  lastPosts: Map<string, number>;
};

/** 覚えておく「最後に書いた時刻」の数がこれを超えたら、古いものを捨てる */
const LAST_POSTS_PRUNE_SIZE = 5000;
/** 低速モードの最長の間隔より長く。これより前に書いた人は覚えておかなくてよい */
const LAST_POSTS_KEEP_MS = 600_000;

/** 間隔を数える単位。ログインした人は id、ゲストは札ごとに id が替わるので IP（分からなければ札の id） */
function posterKey(writer: Writer): string {
  return isGuestId(writer.userId) && writer.ipKey ? `ip:${writer.ipKey}` : writer.userId;
}

/** 配信者かモデレーター。ブロックでき、低速モード・禁止語・フォロワー限定にかからない */
function privileged(writer: Writer | null): boolean {
  return writer !== null && (writer.owner || writer.moderator);
}

type Options = {
  port: number;
  /** 待ち受ける住所。本番は Caddy だけが中継につなぐので 127.0.0.1（deploy/compose.yaml）。無ければすべて */
  host?: string;
  /** コメントの札の署名の鍵（src/lib/comment-token.ts） */
  secret: string;
  /** そのチャンネルの縮小画像。無ければ undefined */
  thumbnail?: (channelId: string) => Buffer | undefined;
  now?: () => number;
  /** 出入りがあってから、見ている人の数を流すまでの待ち */
  viewersDelayMs?: number;
};

/** 出入りがあってから、見ている人の数を流すまでの待ち。開いてすぐ閉じる人が続いても流しすぎない */
const VIEWERS_DELAY_MS = 1000;

/** 見ている人の数。配信者自身のつなぎ（配信の画面と OBS の画面）は数えない */
function viewerCount(room: Room): number {
  let count = 0;
  for (const writer of room.clients.values()) if (!writer?.owner) count += 1;
  return count;
}

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

/**
 * 見せるコメント。自分のコメントには mine を付け、ほかの人のコメントには配信者とモデレーターにだけ書いた人の札を付ける。
 * 配信者とモデレーターのコメントには札を付けない（止められないので、ブロックを出さない）
 */
function shown(entry: Entry, writer: Writer | null): Comment {
  if (writer && writer.userId === entry.userId) return { ...entry.comment, mine: true };
  if (privileged(writer) && !entry.privileged) return { ...entry.comment, author: entry.author };
  return entry.comment;
}

/** 届いた1通。書くコメントか、ブロックか、運営が消すものか、サイトからの指示 */
function parseMessage(
  data: unknown,
): { text: string } | { block: string } | { remove: string } | { command: string } | null {
  try {
    const parsed: unknown = JSON.parse(String(data));
    if (typeof parsed !== 'object' || parsed === null) return null;
    if ('block' in parsed && typeof parsed.block === 'string') return { block: parsed.block };
    if ('remove' in parsed && typeof parsed.remove === 'string') return { remove: parsed.remove };
    if ('command' in parsed && typeof parsed.command === 'string') {
      return { command: parsed.command };
    }
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
 * コメントは保存しない。チャンネルごとに直近のものだけを覚えておき、あとから来た人に見せる。
 * 同じ口で、配信の縮小画像も返す（`GET /thumbnails/<チャンネルの id>.jpg`）
 */
export function startRelay({
  port,
  host,
  secret,
  thumbnail,
  now = Date.now,
  viewersDelayMs = VIEWERS_DELAY_MS,
}: Options) {
  const rooms = new Map<string, Room>();
  const web = createServer((request: IncomingMessage, response: ServerResponse) => {
    const pathname = new URL(request.url ?? '/', 'http://relay').pathname;
    // チャンネルごとの見ている人の数。トップの一覧が読む（src/lib/viewers.ts）。誰もいないチャンネルは載せない
    if (request.method === 'GET' && pathname === VIEWERS_PATH) {
      const counts: Record<string, number> = {};
      for (const [channelId, room] of rooms) {
        const count = viewerCount(room);
        if (count > 0) counts[channelId] = count;
      }
      response
        .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        .end(JSON.stringify(counts));
      return;
    }
    const channelId = THUMBNAIL_PATTERN.exec(pathname)?.[1];
    const image = request.method === 'GET' && channelId ? thumbnail?.(channelId) : undefined;
    if (!image) {
      response.writeHead(404).end();
      return;
    }
    response
      .writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Cache-Control': `public, max-age=${THUMBNAIL_MAX_AGE_S}`,
      })
      .end(image);
  });
  const server = new WebSocketServer({ server: web, maxPayload: MAX_PAYLOAD_BYTES });
  web.listen(port, host);
  const alive = new WeakSet<WebSocket>();

  /** 配信者かモデレーターがブロックした。その人のコメントを消し、つなぎを閉じる */
  function block(room: Room, author: Author, blocker: Writer): void {
    const at = now();
    // 配信者やブロックした人と同じ回線の人を IP で止めると、その人たちまで書けなくなるので、そのときは id だけで止める
    const ipKey =
      author.ipKey === blocker.ipKey || author.ipKey === room.ownerIpKey ? null : author.ipKey;
    const added: Block = { userId: author.userId, ipKey, at };
    room.blocks = [...room.blocks.filter((b) => at - b.at < COMMENT_TOKEN_TTL_MS), added];
    const removed = room.history.filter((entry) => sameAuthor(added, entry.userId, entry.ipKey));
    room.history = room.history.filter((entry) => !removed.includes(entry));
    const ids = removed.map((entry) => entry.comment.id);
    for (const [client, writer] of room.clients) {
      if (ids.length > 0) send(client, { type: 'remove', ids });
      if (writer && !privileged(writer) && blockedWriter(room, writer, at))
        client.close(BLOCKED, 'blocked');
    }
  }

  /**
   * サイトからの指示。決まりは新しければ入れ替え、見る画面に札をもらい直させる（書けるかどうかの知らせを出し直すため）。
   * モデレーターが変わった人は、それより前の札を使えなくしてから、つなぎ直させる
   */
  function apply(room: Room, command: RelayCommand, issuedAt: number): void {
    if (command.kind === 'settings') {
      if (command.settings.at < room.settings.at) return;
      room.settings = command.settings;
      for (const client of room.clients.keys()) send(client, { type: 'rules' });
      return;
    }
    for (const [userId, at] of room.roleChanges) {
      if (now() - at >= COMMENT_TOKEN_TTL_MS) room.roleChanges.delete(userId);
    }
    room.roleChanges.set(command.userId, issuedAt);
    for (const [client, writer] of room.clients) {
      if (writer?.userId === command.userId) client.close(ROLE_CHANGED, 'role changed');
    }
  }

  /** その札が、モデレーターが変わる前に作られたものか */
  function staleRole(room: Room, writer: Writer): boolean {
    const at = room.roleChanges.get(writer.userId);
    return at !== undefined && writer.issuedAt <= at;
  }

  /** 出入りがあった。少し待ってから、部屋の全員にいまの人数を流す */
  function viewersChanged(room: Room): void {
    if (room.viewersTimer) return;
    room.viewersTimer = setTimeout(() => {
      room.viewersTimer = undefined;
      const count = viewerCount(room);
      for (const client of room.clients.keys()) send(client, { type: 'viewers', count });
    }, viewersDelayMs);
  }

  /** 運営が消したコメントを、覚えている分からも全員の画面からも消す */
  function remove(room: Room, id: string): void {
    const kept = room.history.filter((entry) => entry.comment.id !== id);
    // もう覚えていないコメント（直近の分から落ちたもの）は、誰の画面にも残っていない
    if (kept.length === room.history.length) return;
    room.history = kept;
    for (const client of room.clients.keys()) send(client, { type: 'remove', ids: [id] });
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
      room = {
        clients: new Map(),
        history: [],
        blocks: [],
        settings: NO_RULES,
        ownerIpKey: null,
        roleChanges: new Map(),
        lastPosts: new Map(),
      };
      rooms.set(channelId, room);
    }
    const joined = room;
    // 中継が立ち上がり直したあとも決まりを効かせるため、札の決まりが新しければ使う
    if (commenter?.settings && commenter.settings.at > joined.settings.at) {
      joined.settings = commenter.settings;
    }
    // 配信者の回線は、配信者がつないでいなくても、サイトが札に入れて教える
    if (commenter?.owner) joined.ownerIpKey = commenter.ipKey;
    else if (joined.ownerIpKey === null && commenter?.ownerIpKey) {
      joined.ownerIpKey = commenter.ownerIpKey;
    }
    // ブロックより前の札、モデレーターが変わる前の札でつなぎ直してきた人は、読むだけにする
    const writer =
      commenter && !blockedWriter(joined, commenter, now()) && !staleRole(joined, commenter)
        ? commenter
        : null;
    joined.clients.set(socket, writer);
    alive.add(socket);
    send(socket, {
      type: 'history',
      comments: joined.history.map((entry) => shown(entry, writer)),
    });
    viewersChanged(joined);

    socket.on('pong', () => alive.add(socket));
    socket.on('message', (data) => {
      const message = parseMessage(data);
      // 運営が消すもの。サイトのサーバーが札なしでつなぎ、消す札を送ってくる（src/lib/comment-removal.ts）
      if (message && 'remove' in message) {
        const id = verifyRemoval(secret, message.remove, channelId, now());
        if (id) {
          remove(joined, id);
          send(socket, { type: 'removed', id });
        } else {
          send(socket, { type: 'error', message: '消す札が合いません' });
        }
        return;
      }
      // サイトからの指示。消すものと同じく、サイトのサーバーが札なしでつないで送ってくる（src/lib/comment-removal.ts の commandRelay）
      if (message && 'command' in message) {
        const verified = verifyRelayCommand(secret, message.command, channelId, now());
        if (verified) {
          apply(joined, verified.command, verified.issuedAt);
          send(socket, { type: 'applied' });
        } else {
          send(socket, { type: 'error', message: '指示の札が合いません' });
        }
        return;
      }
      if (!writer) {
        send(socket, { type: 'error', message: 'コメントするにはログインしてください' });
        return;
      }
      if (!message) return;
      if ('block' in message) {
        const author = verifyAuthor(secret, message.block, channelId);
        // 配信者とモデレーターだけが止められる。配信者とモデレーターは止められない
        if (privileged(writer) && author && author.userId !== writer.userId && !author.privileged) {
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
      // 配信者とモデレーターは、配信者の決めた決まりにかからない
      const ruled = !privileged(writer);
      const { settings } = joined;
      if (ruled && !followerMayWrite(settings, writer.followedAt, at)) {
        send(socket, {
          type: 'error',
          message: followersOnlyMessage(settings.followersOnlyMinutes ?? 0),
        });
        return;
      }
      const slowMs = ruled ? settings.slowSeconds * 1000 : 0;
      const poster = posterKey(writer);
      const lastPostAt = joined.lastPosts.get(poster) ?? -Infinity;
      if (at - lastPostAt < Math.max(POST_INTERVAL_MS, slowMs)) {
        send(socket, {
          type: 'error',
          message:
            slowMs > POST_INTERVAL_MS
              ? `低速モードです。${settings.slowSeconds}秒あけて書いてください`
              : '少し待ってから書いてください',
        });
        return;
      }
      if (joined.lastPosts.size > LAST_POSTS_PRUNE_SIZE) {
        for (const [key, time] of joined.lastPosts) {
          if (at - time > LAST_POSTS_KEEP_MS) joined.lastPosts.delete(key);
        }
      }
      joined.lastPosts.set(poster, at);
      const comment = {
        id: randomUUID(),
        name: writer.displayName,
        text: message.text,
        at,
        guest: isGuestId(writer.userId),
      };
      // 禁止語を含むコメントは、書いた人の画面にだけ流す。ほかの人には届かず、覚えもしない。書いた人には止められたことが分からない
      if (ruled && hasBlockedWord(message.text, settings.blockedWords)) {
        send(socket, { type: 'comment', comment: { ...comment, mine: true } });
        return;
      }
      const entry: Entry = {
        comment: { ...comment, proof: signCommentProof(secret, channelId, comment) },
        userId: writer.userId,
        ipKey: writer.ipKey,
        author: signAuthor(secret, channelId, {
          userId: writer.userId,
          displayName: writer.displayName,
          ipKey: writer.ipKey,
          privileged: !ruled,
        }),
        privileged: !ruled,
      };
      joined.history = [...joined.history, entry].slice(-HISTORY_SIZE);
      for (const [client, viewer] of joined.clients) {
        send(client, { type: 'comment', comment: shown(entry, viewer) });
      }
    });
    socket.on('close', () => {
      joined.clients.delete(socket);
      viewersChanged(joined);
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
    listening: new Promise<void>((resolve) => web.once('listening', () => resolve())),
    /** 実際に開いた番号。0 を渡したときに空いている番号が入る */
    port: () => (web.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(ping);
        for (const room of rooms.values()) clearTimeout(room.viewersTimer);
        for (const socket of server.clients) socket.terminate();
        server.close();
        web.close(() => resolve());
        // 画像を取りに来た人のつなぎ（keep-alive）が残っていると閉じ終わらない
        web.closeAllConnections();
      }),
  };
}
