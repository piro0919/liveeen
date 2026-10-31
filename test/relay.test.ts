import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startRelay } from '../relay/relay';
import { commandRelay, removeFromRelay } from '@/lib/comment-removal';
import { BLOCKED, guestId, type RelayMessage, ROLE_CHANGED, TOKEN_EXPIRED } from '@/lib/comment';
import { type CommentSettings, NO_RULES } from '@/lib/comment-settings';
import {
  COMMENT_TOKEN_TTL_MS,
  signAuthor,
  signCommentToken,
  signRemoval,
  verifyCommentProof,
} from '@/lib/comment-token';

const SECRET = 'relay-secret';
const CHANNEL = 'abc123';
const HOUR_MS = 3_600_000;

let relay: ReturnType<typeof startRelay>;
let clock: number;

beforeEach(() => {
  clock = 1_800_000_000_000;
  // 見ている人の数は、届く順番を乱さないよう流さない（別の describe で確かめる）
  relay = startRelay({ port: 0, secret: SECRET, now: () => clock, viewersDelayMs: HOUR_MS });
});

afterEach(async () => {
  await relay.close();
});

/** つないで、届いたものを順にためる */
async function connect(channelId: string, token?: string) {
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  const socket = new WebSocket(`ws://localhost:${relay.port()}/${channelId}${query}`);
  const received: RelayMessage[] = [];
  const waiters: (() => void)[] = [];
  socket.on('message', (data) => {
    received.push(JSON.parse(String(data)) as RelayMessage);
    waiters.splice(0).forEach((resolve) => resolve());
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
  /** n 通目が届くまで待つ */
  const nth = async (n: number) => {
    while (received.length < n) await new Promise<void>((resolve) => waiters.push(resolve));
    return received[n - 1];
  };
  return { socket, received, nth };
}

function tokenFor(
  name: string,
  channelId = CHANNEL,
  {
    ipKey = `ip-${name}`,
    owner = false,
    moderator = false,
    followedAt = null,
    settings,
    ownerIpKey = null,
    avatar = null,
  }: {
    ipKey?: string | null;
    owner?: boolean;
    moderator?: boolean;
    followedAt?: number | null;
    settings?: CommentSettings;
    ownerIpKey?: string | null;
    avatar?: string | null;
  } = {},
) {
  const commenter = {
    userId: `id-${name}`,
    displayName: name,
    ipKey,
    owner,
    moderator,
    followedAt,
    settings,
    ownerIpKey,
    avatar,
  };
  return signCommentToken(SECRET, channelId, commenter, clock);
}

describe('コメントの中継', () => {
  it('札のある人のコメントを、同じチャンネルの全員に名前付きで流す', async () => {
    const writer = await connect(CHANNEL, tokenFor('ぴろ'));
    const viewer = await connect(CHANNEL);
    const elsewhere = await connect('other');
    await writer.nth(1);
    await viewer.nth(1);
    writer.socket.send(JSON.stringify({ text: ' こんにちは ' }));
    const got = await viewer.nth(2);
    expect(got).toMatchObject({
      type: 'comment',
      comment: { name: 'ぴろ', text: 'こんにちは', guest: false },
    });
    expect(await writer.nth(2)).toEqual(
      got.type === 'comment' && { ...got, comment: { ...got.comment, mine: true } },
    );
    expect(elsewhere.received).toEqual([{ type: 'history', comments: [] }]);
  });

  it('札に印の画像があればコメントに付けて流し、無ければ付けない', async () => {
    const pictured = await connect(
      CHANNEL,
      tokenFor('ぴろ', CHANNEL, { avatar: '/api/avatar/k1' }),
    );
    const plain = await connect(CHANNEL, tokenFor('みる'));
    const viewer = await connect(CHANNEL);
    await pictured.nth(1);
    await plain.nth(1);
    await viewer.nth(1);
    pictured.socket.send(JSON.stringify({ text: '写真あり' }));
    expect(await viewer.nth(2)).toMatchObject({
      type: 'comment',
      comment: { name: 'ぴろ', avatar: '/api/avatar/k1' },
    });
    plain.socket.send(JSON.stringify({ text: '写真なし' }));
    const got = await viewer.nth(3);
    expect(got).toMatchObject({ type: 'comment', comment: { name: 'みる' } });
    expect(got.type === 'comment' ? got.comment : null).not.toHaveProperty('avatar');
  });

  it('ログインしていない人の札で書いたコメントには guest の印が付く', async () => {
    const guestToken = signCommentToken(
      SECRET,
      CHANNEL,
      {
        userId: guestId('00000000-0000-4000-8000-000000000000'),
        displayName: 'ぴろ',
        ipKey: null,
        owner: false,
      },
      clock,
    );
    const writer = await connect(CHANNEL, guestToken);
    await writer.nth(1);
    writer.socket.send(JSON.stringify({ text: 'なりすまし' }));
    expect(await writer.nth(2)).toMatchObject({
      type: 'comment',
      comment: { name: 'ぴろ', guest: true },
    });
  });

  it('あとから来た人には、それまでのコメントを先に見せる', async () => {
    const writer = await connect(CHANNEL, tokenFor('ぴろ'));
    writer.socket.send(JSON.stringify({ text: '1つ目' }));
    await writer.nth(2);
    const late = await connect(CHANNEL);
    expect(await late.nth(1)).toMatchObject({
      type: 'history',
      comments: [{ name: 'ぴろ', text: '1つ目' }],
    });
  });

  it('札が無ければ書けない', async () => {
    const viewer = await connect(CHANNEL);
    await viewer.nth(1);
    viewer.socket.send(JSON.stringify({ text: 'こんにちは' }));
    expect(await viewer.nth(2)).toMatchObject({ type: 'error' });
  });

  it('ほかのチャンネルの札では書けない', async () => {
    const writer = await connect(CHANNEL, tokenFor('ぴろ', 'other'));
    await writer.nth(1);
    writer.socket.send(JSON.stringify({ text: 'こんにちは' }));
    expect(await writer.nth(2)).toMatchObject({ type: 'error' });
  });

  it('続けて書くと断り、間を空ければ通す', async () => {
    const writer = await connect(CHANNEL, tokenFor('ぴろ'));
    writer.socket.send(JSON.stringify({ text: '1' }));
    await writer.nth(2);
    writer.socket.send(JSON.stringify({ text: '2' }));
    expect(await writer.nth(3)).toMatchObject({ type: 'error' });
    clock += 1000;
    writer.socket.send(JSON.stringify({ text: '3' }));
    expect(await writer.nth(4)).toMatchObject({ type: 'comment', comment: { text: '3' } });
  });

  it('つないだあとで札の期限が切れたら、書かせずに閉じる', async () => {
    const writer = await connect(CHANNEL, tokenFor('ぴろ'));
    const viewer = await connect(CHANNEL);
    await viewer.nth(1);
    const closed = new Promise<number>((resolve) => writer.socket.once('close', resolve));
    clock += COMMENT_TOKEN_TTL_MS + 1;
    writer.socket.send(JSON.stringify({ text: '遅れて' }));
    expect(await writer.nth(2)).toMatchObject({ type: 'error' });
    expect(await closed).toBe(TOKEN_EXPIRED);
    expect(viewer.received).toHaveLength(1);
  });

  it('書いた人の札は配信者にだけ付ける', async () => {
    const owner = await connect(CHANNEL, tokenFor('配信者', CHANNEL, { owner: true }));
    const viewer = await connect(CHANNEL);
    const writer = await connect(CHANNEL, tokenFor('荒らし'));
    writer.socket.send(JSON.stringify({ text: 'やあ' }));
    const toOwner = await owner.nth(2);
    const toViewer = await viewer.nth(2);
    expect(toOwner).toMatchObject({ type: 'comment', comment: { author: expect.any(String) } });
    expect(toViewer).toMatchObject({ type: 'comment' });
    expect(toViewer.type === 'comment' && toViewer.comment.author).toBeUndefined();
  });

  it('配信者自身のコメントには札を付けず mine を付ける', async () => {
    const owner = await connect(CHANNEL, tokenFor('配信者', CHANNEL, { owner: true }));
    owner.socket.send(JSON.stringify({ text: '自分で書く' }));
    const toOwner = await owner.nth(2);
    expect(toOwner).toMatchObject({ type: 'comment', comment: { mine: true } });
    expect(toOwner.type === 'comment' && toOwner.comment.author).toBeUndefined();
  });

  it('配信者がブロックすると、その人のコメントを消し、つなぎを閉じ、前の札では書かせない', async () => {
    const owner = await connect(CHANNEL, tokenFor('配信者', CHANNEL, { owner: true }));
    const viewer = await connect(CHANNEL);
    const trollToken = tokenFor('荒らし');
    const troll = await connect(CHANNEL, trollToken);
    troll.socket.send(JSON.stringify({ text: '荒らす' }));
    const comment = await owner.nth(2);
    await viewer.nth(2);
    const closed = new Promise<number>((resolve) => troll.socket.once('close', resolve));
    const author = comment.type === 'comment' ? comment.comment.author : undefined;
    owner.socket.send(JSON.stringify({ block: author }));
    const removedId = comment.type === 'comment' ? comment.comment.id : '';
    expect(await viewer.nth(3)).toEqual({ type: 'remove', ids: [removedId] });
    expect(await closed).toBe(BLOCKED);

    const again = await connect(CHANNEL, trollToken);
    expect(await again.nth(1)).toEqual({ type: 'history', comments: [] });
    again.socket.send(JSON.stringify({ text: 'まだいる' }));
    expect(await again.nth(2)).toMatchObject({ type: 'error' });
  });

  it('同じ IP の別の札も止め、ブロックの後に作られた札は通す', async () => {
    const owner = await connect(CHANNEL, tokenFor('配信者', CHANNEL, { owner: true }));
    const troll = await connect(CHANNEL, tokenFor('荒らし', CHANNEL, { ipKey: 'ip-x' }));
    const sameIp = tokenFor('別名', CHANNEL, { ipKey: 'ip-x' });
    troll.socket.send(JSON.stringify({ text: '荒らす' }));
    const comment = await owner.nth(2);
    const author = comment.type === 'comment' ? comment.comment.author : undefined;
    owner.socket.send(JSON.stringify({ block: author }));
    await owner.nth(3);

    const renamed = await connect(CHANNEL, sameIp);
    renamed.socket.send(JSON.stringify({ text: '名前を変えた' }));
    expect(await renamed.nth(2)).toMatchObject({ type: 'error' });

    // 戻したあとにサイトが出した札。止めた時刻より後に作られている
    clock += 1000;
    const later = await connect(CHANNEL, tokenFor('別名', CHANNEL, { ipKey: 'ip-x' }));
    later.socket.send(JSON.stringify({ text: '戻った' }));
    expect(await later.nth(2)).toMatchObject({ type: 'comment', comment: { text: '戻った' } });
  });

  it('配信者でない人のブロックは聞かない', async () => {
    const owner = await connect(CHANNEL, tokenFor('配信者', CHANNEL, { owner: true }));
    const writer = await connect(CHANNEL, tokenFor('見る人'));
    const other = await connect(CHANNEL, tokenFor('別の人'));
    writer.socket.send(JSON.stringify({ text: 'やあ' }));
    const comment = await owner.nth(2);
    await other.nth(2);
    const author = comment.type === 'comment' ? comment.comment.author : undefined;
    other.socket.send(JSON.stringify({ block: author }));
    clock += 1000;
    writer.socket.send(JSON.stringify({ text: 'まだ書ける' }));
    expect(await writer.nth(3)).toMatchObject({
      type: 'comment',
      comment: { text: 'まだ書ける' },
    });
  });

  it('配信者と同じ IP の人は、IP では止めない', async () => {
    const owner = await connect(
      CHANNEL,
      tokenFor('配信者', CHANNEL, { owner: true, ipKey: 'ip-home' }),
    );
    const family = await connect(CHANNEL, tokenFor('家族', CHANNEL, { ipKey: 'ip-home' }));
    const neighbor = await connect(CHANNEL, tokenFor('同じ家', CHANNEL, { ipKey: 'ip-home' }));
    family.socket.send(JSON.stringify({ text: 'やあ' }));
    const comment = await owner.nth(2);
    await neighbor.nth(2);
    const author = comment.type === 'comment' ? comment.comment.author : undefined;
    owner.socket.send(JSON.stringify({ block: author }));
    await owner.nth(3);
    clock += 1000;
    neighbor.socket.send(JSON.stringify({ text: '書ける' }));
    expect(await neighbor.nth(4)).toMatchObject({ type: 'comment', comment: { text: '書ける' } });
    clock += 1000;
    owner.socket.send(JSON.stringify({ text: '配信者も書ける' }));
    expect(await owner.nth(5)).toMatchObject({
      type: 'comment',
      comment: { text: '配信者も書ける' },
    });
  });

  it('コメントに中継の印を付け、自分のコメントにだけ mine を付ける', async () => {
    const writer = await connect(CHANNEL, tokenFor('ぴろ'));
    const other = await connect(CHANNEL, tokenFor('見る人'));
    writer.socket.send(JSON.stringify({ text: 'やあ' }));
    const toWriter = await writer.nth(2);
    const toOther = await other.nth(2);
    expect(toWriter).toMatchObject({ type: 'comment', comment: { mine: true } });
    if (toOther.type !== 'comment') throw new Error('コメントが届いていません');
    expect(toOther.comment.mine).toBeUndefined();
    const { id, name, text, at, guest, proof } = toOther.comment;
    const shown = { id, name, text, at, guest };
    expect(verifyCommentProof(SECRET, CHANNEL, shown, proof ?? '')).toBe(true);
    expect(verifyCommentProof(SECRET, CHANNEL, { ...shown, text: '書き換え' }, proof ?? '')).toBe(
      false,
    );
    expect(verifyCommentProof(SECRET, 'other', shown, proof ?? '')).toBe(false);
  });

  it('運営の消す札で、そのコメントを全員の画面と覚えている分から消す', async () => {
    const writer = await connect(CHANNEL, tokenFor('荒らし'));
    const viewer = await connect(CHANNEL);
    writer.socket.send(JSON.stringify({ text: '消される' }));
    const comment = await viewer.nth(2);
    const id = comment.type === 'comment' ? comment.comment.id : '';
    const site = await connect(CHANNEL);
    site.socket.send(JSON.stringify({ remove: signRemoval(SECRET, CHANNEL, id, clock) }));
    expect(await viewer.nth(3)).toEqual({ type: 'remove', ids: [id] });
    expect(await writer.nth(3)).toEqual({ type: 'remove', ids: [id] });
    expect(await site.nth(3)).toEqual({ type: 'removed', id });
    const late = await connect(CHANNEL);
    expect(await late.nth(1)).toEqual({ type: 'history', comments: [] });
  });

  it('サイトのサーバーからの消す知らせは、中継が受け取ったときだけ解ける', async () => {
    const writer = await connect(CHANNEL, tokenFor('荒らし'));
    const viewer = await connect(CHANNEL);
    writer.socket.send(JSON.stringify({ text: '消される' }));
    const comment = await viewer.nth(2);
    const id = comment.type === 'comment' ? comment.comment.id : '';
    const url = `ws://localhost:${relay.port()}`;
    await expect(removeFromRelay(url, 'other-secret', CHANNEL, id)).rejects.toThrow('断りました');
    clock = Date.now();
    await removeFromRelay(url, SECRET, CHANNEL, id);
    expect(await viewer.nth(3)).toEqual({ type: 'remove', ids: [id] });
  });

  it('ほかのチャンネルの消す札、期限の切れた札、署名の違う札では消さない', async () => {
    const writer = await connect(CHANNEL, tokenFor('ぴろ'));
    writer.socket.send(JSON.stringify({ text: '残る' }));
    const comment = await writer.nth(2);
    const id = comment.type === 'comment' ? comment.comment.id : '';
    const site = await connect(CHANNEL);
    const removals = [
      signRemoval(SECRET, 'other', id, clock),
      signRemoval(SECRET, CHANNEL, id, clock - 61_000),
      signRemoval('other-secret', CHANNEL, id, clock),
    ];
    for (const remove of removals) site.socket.send(JSON.stringify({ remove }));
    await site.nth(4);
    expect(site.received.slice(1).map((message) => message.type)).toEqual([
      'error',
      'error',
      'error',
    ]);
    clock += 1000;
    writer.socket.send(JSON.stringify({ text: '次' }));
    expect(await writer.nth(3)).toMatchObject({ type: 'comment', comment: { text: '次' } });
    const late = await connect(CHANNEL);
    expect(await late.nth(1)).toMatchObject({
      type: 'history',
      comments: [{ text: '残る' }, { text: '次' }],
    });
  });

  it('消す知らせのつなぎは Connection: Upgrade を大文字で送る（本番の Caddy は大文字小文字を見分けて中継へ振る）', async () => {
    const server = createServer();
    const seen = new Promise<string | undefined>((resolve) =>
      server.once('upgrade', (request: IncomingMessage, socket: Duplex) => {
        resolve(request.headers.connection);
        socket.destroy();
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    const sent = removeFromRelay(`ws://localhost:${port}`, SECRET, CHANNEL, 'id').catch(() => {});
    // deploy/Caddyfile の `header Connection *Upgrade*` と同じ見方
    expect(await seen).toContain('Upgrade');
    await sent;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('形の合わない名前のチャンネルにはつながせない', async () => {
    const socket = new WebSocket(`ws://localhost:${relay.port()}/a/b`);
    const code = await new Promise<number>((resolve) => socket.once('close', resolve));
    expect(code).toBe(1008);
  });
});

describe('中継の縮小画像', () => {
  const IMAGE = Buffer.from([0xff, 0xd8, 0xff]);
  let withImages: ReturnType<typeof startRelay>;

  beforeEach(() => {
    withImages = startRelay({
      port: 0,
      secret: SECRET,
      thumbnail: (channelId) => (channelId === CHANNEL ? IMAGE : undefined),
    });
  });

  afterEach(async () => {
    await withImages.close();
  });

  it('撮れているチャンネルの画像を JPEG で返す', async () => {
    const response = await fetch(
      `http://localhost:${withImages.port()}/thumbnails/${CHANNEL}.jpg?v=1`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(IMAGE);
  });

  it('撮れていないチャンネルと、形の合わない住所は 404', async () => {
    const base = `http://localhost:${withImages.port()}`;
    expect((await fetch(`${base}/thumbnails/other.jpg`)).status).toBe(404);
    expect((await fetch(`${base}/thumbnails/../${CHANNEL}.jpg`)).status).toBe(404);
    expect((await fetch(`${base}/${CHANNEL}`)).status).toBe(404);
  });

  it('画像を返す口でもコメントの中継はつながる', async () => {
    const socket = new WebSocket(`ws://localhost:${withImages.port()}/${CHANNEL}`);
    const first = await new Promise<string>((resolve) =>
      socket.once('message', (data) => resolve(String(data))),
    );
    expect(JSON.parse(first)).toEqual({ type: 'history', comments: [] });
    socket.close();
  });
});

describe('見ている人の数', () => {
  // 3人がつなぎ終わるまでに流れないだけの長さ
  const DELAY_MS = 200;
  let counted: ReturnType<typeof startRelay>;

  beforeEach(() => {
    counted = startRelay({ port: 0, secret: SECRET, now: () => clock, viewersDelayMs: DELAY_MS });
  });

  afterEach(async () => {
    await counted.close();
  });

  /** 次の viewers が届くまで待つ */
  function nextViewers(socket: WebSocket) {
    return new Promise<number>((resolve) => {
      const listen = (data: unknown) => {
        const message = JSON.parse(String(data)) as RelayMessage;
        if (message.type === 'viewers') {
          socket.off('message', listen);
          resolve(message.count);
        }
      };
      socket.on('message', listen);
    });
  }

  async function open(token?: string) {
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    const socket = new WebSocket(`ws://localhost:${counted.port()}/${CHANNEL}${query}`);
    const first = nextViewers(socket);
    await new Promise<void>((resolve) => socket.once('open', () => resolve()));
    return { socket, first };
  }

  it('出入りのたびに、配信者を除いた人数を部屋の全員に流す', async () => {
    const owner = await open(tokenFor('配信者', CHANNEL, { owner: true }));
    const viewer = await open();
    const writer = await open(tokenFor('ぴろ'));
    expect(await owner.first).toBe(2);
    expect(await viewer.first).toBe(2);
    expect(await writer.first).toBe(2);
    const afterLeave = nextViewers(owner.socket);
    viewer.socket.close();
    expect(await afterLeave).toBe(1);
    owner.socket.close();
    writer.socket.close();
  });

  it('チャンネルごとの人数を HTTP で返す。誰もいないチャンネルは載せない', async () => {
    const base = `http://localhost:${counted.port()}`;
    const owner = await open(tokenFor('配信者', CHANNEL, { owner: true }));
    const viewer = await open();
    await owner.first;
    const response = await fetch(`${base}/viewers`);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual({ [CHANNEL]: 1 });
    const left = nextViewers(owner.socket);
    viewer.socket.close();
    await left;
    expect(await (await fetch(`${base}/viewers`)).json()).toEqual({});
    owner.socket.close();
  });
});

describe('コメントの決まり', () => {
  beforeEach(() => {
    // サイトからの指示の札は、いまの時刻で作られる（src/lib/comment-removal.ts の commandRelay）
    clock = Date.now();
  });

  /** 決まりを入れた札。at はサイトで決まりを変えた時刻 */
  function rules(partial: Partial<CommentSettings>): CommentSettings {
    return { ...NO_RULES, at: clock, ...partial };
  }

  /** コメントを書き、次に届いたものを返す。その前に届いているはずのものを数で渡す */
  async function post(
    client: Awaited<ReturnType<typeof connect>>,
    text: string,
    already: number,
  ): Promise<RelayMessage> {
    await client.nth(already);
    client.socket.send(JSON.stringify({ text }));
    return client.nth(already + 1);
  }

  it('低速モードでは、決めた秒数がたつまで書かせない', async () => {
    const settings = rules({ slowSeconds: 10 });
    const writer = await connect(CHANNEL, tokenFor('ぴろ', CHANNEL, { settings }));
    expect(await post(writer, '1', 1)).toMatchObject({ type: 'comment' });
    clock += 5000;
    expect(await post(writer, '2', 2)).toEqual({
      type: 'error',
      code: 'slowMode',
      seconds: 10,
    });
    clock += 5000;
    expect(await post(writer, '3', 3)).toMatchObject({ type: 'comment', comment: { text: '3' } });
  });

  it('配信者とモデレーターは低速モードにかからない', async () => {
    const settings = rules({ slowSeconds: 10 });
    const owner = await connect(CHANNEL, tokenFor('配信者', CHANNEL, { owner: true, settings }));
    expect(await post(owner, 'a', 1)).toMatchObject({ type: 'comment' });
    clock += 1000;
    expect(await post(owner, 'b', 2)).toMatchObject({ type: 'comment', comment: { text: 'b' } });
    const mod = await connect(CHANNEL, tokenFor('モデ', CHANNEL, { moderator: true, settings }));
    expect(await post(mod, 'c', 1)).toMatchObject({ type: 'comment' });
    clock += 1000;
    expect(await post(mod, 'd', 2)).toMatchObject({ type: 'comment', comment: { text: 'd' } });
  });

  it('禁止語を含むコメントは書いた人にだけ見せ、ほかの人に流さず、覚えない', async () => {
    const settings = rules({ blockedWords: ['ばか', 'baka'] });
    const writer = await connect(CHANNEL, tokenFor('ぴろ', CHANNEL, { settings }));
    const viewer = await connect(CHANNEL);
    expect(await post(writer, 'ばかだなあ', 1)).toMatchObject({
      type: 'comment',
      comment: { mine: true, text: 'ばかだなあ' },
    });
    clock += 1000;
    // 全角と大文字も同じに見る
    expect(await post(writer, 'ＢＡＫＡ！', 2)).toMatchObject({
      type: 'comment',
      comment: { mine: true },
    });
    clock += 1000;
    expect(await post(writer, 'こんにちは', 3)).toMatchObject({ type: 'comment' });
    // 見る人に届いたのは、禁止語の無い1通だけ
    expect(await viewer.nth(2)).toMatchObject({ type: 'comment', comment: { text: 'こんにちは' } });
    const late = await connect(CHANNEL);
    expect(await late.nth(1)).toMatchObject({
      type: 'history',
      comments: [{ text: 'こんにちは' }],
    });
  });

  it('モデレーターは禁止語にかからない', async () => {
    const settings = rules({ blockedWords: ['ばか'] });
    const mod = await connect(CHANNEL, tokenFor('モデ', CHANNEL, { moderator: true, settings }));
    const viewer = await connect(CHANNEL);
    await post(mod, 'ばかと書いたら止めます', 1);
    expect(await viewer.nth(2)).toMatchObject({ type: 'comment' });
  });

  it('フォロワー限定では、フォローして決めた分数がたった人だけ書ける', async () => {
    const settings = rules({ followersOnlyMinutes: 10 });
    const stranger = await connect(CHANNEL, tokenFor('通りすがり', CHANNEL, { settings }));
    expect(await post(stranger, 'やあ', 1)).toEqual({
      type: 'error',
      code: 'followersOnly',
      minutes: 10,
    });
    const fresh = await connect(
      CHANNEL,
      tokenFor('さっき', CHANNEL, { settings, followedAt: clock - 5 * 60_000 }),
    );
    expect(await post(fresh, 'やあ', 1)).toMatchObject({ type: 'error' });
    const fan = await connect(
      CHANNEL,
      tokenFor('古参', CHANNEL, { settings, followedAt: clock - 10 * 60_000 }),
    );
    expect(await post(fan, 'やあ', 1)).toMatchObject({
      type: 'comment',
      comment: { text: 'やあ' },
    });
  });

  it('サイトからの指示で、つないでいる人にもその場で決まりを効かせる。古い決まりでは上書きしない', async () => {
    const relayUrl = `ws://localhost:${relay.port()}`;
    const writer = await connect(CHANNEL, tokenFor('ぴろ'));
    await writer.nth(1);
    await commandRelay(relayUrl, SECRET, CHANNEL, {
      kind: 'settings',
      settings: rules({ followersOnlyMinutes: 0 }),
    });
    expect(await writer.nth(2)).toEqual({ type: 'rules' });
    expect(await post(writer, 'やあ', 2)).toEqual({
      type: 'error',
      code: 'followersOnly',
      minutes: 0,
    });
    // あとから来た人の、古い札の決まりでは戻らない
    const stale = await connect(
      CHANNEL,
      tokenFor('別の人', CHANNEL, { settings: { ...NO_RULES, at: clock - 1 } }),
    );
    expect(await post(stale, 'やあ', 1)).toMatchObject({ type: 'error' });
    clock += 1000;
    await commandRelay(relayUrl, SECRET, CHANNEL, { kind: 'settings', settings: rules({}) });
    expect(await post(writer, 'やあ', 4)).toMatchObject({ type: 'comment' });
  });

  it('中継が立ち上がり直しても、つないできた人の札の決まりを使う', async () => {
    const settings = rules({ followersOnlyMinutes: 0 });
    const first = await connect(CHANNEL, tokenFor('ぴろ', CHANNEL, { settings }));
    const other = await connect(CHANNEL, tokenFor('別の人'));
    expect(await post(first, 'やあ', 1)).toMatchObject({ type: 'error' });
    expect(await post(other, 'やあ', 1)).toMatchObject({ type: 'error' });
  });

  it('署名の違う指示は聞かない', async () => {
    const relayUrl = `ws://localhost:${relay.port()}`;
    await expect(
      commandRelay(relayUrl, 'wrong-secret', CHANNEL, {
        kind: 'settings',
        settings: rules({ followersOnlyMinutes: 0 }),
      }),
    ).rejects.toThrow('badCommand');
    const writer = await connect(CHANNEL, tokenFor('ぴろ'));
    expect(await post(writer, 'やあ', 1)).toMatchObject({ type: 'comment' });
  });

  it('モデレーターにも書いた人の札を付け、配信者とモデレーターのコメントには付けない', async () => {
    const owner = await connect(CHANNEL, tokenFor('配信者', CHANNEL, { owner: true }));
    const mod = await connect(CHANNEL, tokenFor('モデ', CHANNEL, { moderator: true }));
    const other = await connect(CHANNEL, tokenFor('別のモデ', CHANNEL, { moderator: true }));
    const troll = await connect(CHANNEL, tokenFor('荒らし'));
    await post(owner, '配信者です', 1);
    await post(other, 'モデです', 2);
    await post(troll, '荒らす', 3);
    const toMod = await Promise.all([mod.nth(2), mod.nth(3), mod.nth(4)]);
    const authors = toMod.map((m) => (m.type === 'comment' ? m.comment.author : 'x'));
    expect(authors[0]).toBeUndefined();
    expect(authors[1]).toBeUndefined();
    expect(authors[2]).toEqual(expect.any(String));
  });

  it('モデレーターがブロックすると、その人のつなぎを閉じる。モデレーターは止められない', async () => {
    const mod = await connect(CHANNEL, tokenFor('モデ', CHANNEL, { moderator: true }));
    const other = await connect(CHANNEL, tokenFor('別のモデ', CHANNEL, { moderator: true }));
    const troll = await connect(CHANNEL, tokenFor('荒らし'));
    const owner = await connect(CHANNEL, tokenFor('配信者', CHANNEL, { owner: true }));
    await post(troll, '荒らす', 1);
    const toMod = await mod.nth(2);
    const closed = new Promise<number>((resolve) => troll.socket.once('close', resolve));
    mod.socket.send(
      JSON.stringify({ block: toMod.type === 'comment' ? toMod.comment.author : '' }),
    );
    expect(await closed).toBe(BLOCKED);
    // 別のモデレーターのコメントは、配信者から見ても札が無く、止められない
    clock += 1000;
    // 届いているのは、つないだときの流れ・荒らしのコメント・消す知らせ
    const fromOther = await post(other, 'モデです', 3);
    expect(fromOther).toMatchObject({ type: 'comment', comment: { mine: true } });
    const toOwner = await owner.nth(4);
    expect(toOwner.type === 'comment' && toOwner.comment.author).toBeUndefined();
  });

  it('配信者かモデレーターだった人の札では止めない', async () => {
    const mod = await connect(CHANNEL, tokenFor('モデ', CHANNEL, { moderator: true }));
    const otherToken = tokenFor('別のモデ', CHANNEL, { moderator: true });
    await mod.nth(1);
    const author = signAuthor(SECRET, CHANNEL, {
      userId: 'id-別のモデ',
      displayName: '別のモデ',
      ipKey: 'ip-別のモデ',
      privileged: true,
    });
    mod.socket.send(JSON.stringify({ block: author }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    clock += 1000;
    // ブロックより前の札でつなぎ直しても書ける
    const other = await connect(CHANNEL, otherToken);
    expect(await post(other, 'まだ書ける', 1)).toMatchObject({ type: 'comment' });
  });

  it('モデレーターと同じ IP の人も、配信者と同じ IP の人も、IP では止めない', async () => {
    const sameHomeToken = tokenFor('同じ家', CHANNEL, { ipKey: 'ip-home' });
    const sameRoomToken = tokenFor('同じ部屋', CHANNEL, { ipKey: 'ip-mod' });
    await connect(CHANNEL, tokenFor('配信者', CHANNEL, { owner: true, ipKey: 'ip-home' }));
    const mod = await connect(
      CHANNEL,
      tokenFor('モデ', CHANNEL, { moderator: true, ipKey: 'ip-mod' }),
    );
    const family = await connect(CHANNEL, tokenFor('家族', CHANNEL, { ipKey: 'ip-home' }));
    await post(family, 'やあ', 1);
    const toMod1 = await mod.nth(2);
    const roommate = await connect(CHANNEL, tokenFor('同居', CHANNEL, { ipKey: 'ip-mod' }));
    await post(roommate, 'やあ', 1);
    const toMod2 = await mod.nth(3);
    for (const message of [toMod1, toMod2]) {
      mod.socket.send(
        JSON.stringify({ block: message.type === 'comment' ? message.comment.author : '' }),
      );
    }
    await mod.nth(5);
    clock += 1000;
    // ブロックより前に作られた札。IP で止めていれば書けない
    const sameHome = await connect(CHANNEL, sameHomeToken);
    expect(await post(sameHome, '書ける', 1)).toMatchObject({ type: 'comment' });
    const sameRoom = await connect(CHANNEL, sameRoomToken);
    expect(await post(sameRoom, '書ける', 1)).toMatchObject({ type: 'comment' });
  });

  it('モデレーターが変わった人のつなぎだけを閉じ、つなぎ直させる', async () => {
    const viewer = await connect(CHANNEL, tokenFor('見る人'));
    const other = await connect(CHANNEL, tokenFor('別の人'));
    await viewer.nth(1);
    const closed = new Promise<number>((resolve) => viewer.socket.once('close', resolve));
    await commandRelay(`ws://localhost:${relay.port()}`, SECRET, CHANNEL, {
      kind: 'roles',
      userId: 'id-見る人',
    });
    expect(await closed).toBe(ROLE_CHANGED);
    expect(other.socket.readyState).toBe(WebSocket.OPEN);
  });
});

describe('レビューで直した決まり', () => {
  beforeEach(() => {
    clock = Date.now();
  });

  async function post(
    client: Awaited<ReturnType<typeof connect>>,
    text: string,
    already: number,
  ): Promise<RelayMessage> {
    await client.nth(already);
    client.socket.send(JSON.stringify({ text }));
    return client.nth(already + 1);
  }

  it('外されたモデレーターは、外される前の札でつなぎ直しても書けない', async () => {
    const oldToken = tokenFor('モデ', CHANNEL, { moderator: true });
    const mod = await connect(CHANNEL, oldToken);
    await mod.nth(1);
    const closed = new Promise<number>((resolve) => mod.socket.once('close', resolve));
    clock += 1;
    await commandRelay(`ws://localhost:${relay.port()}`, SECRET, CHANNEL, {
      kind: 'roles',
      userId: 'id-モデ',
    });
    expect(await closed).toBe(ROLE_CHANGED);
    const again = await connect(CHANNEL, oldToken);
    expect(await post(again, 'まだモデ', 1)).toMatchObject({ type: 'error' });
    // 指示のあとにサイトが作った札なら書ける
    clock = Date.now() + 1000;
    const fresh = await connect(CHANNEL, tokenFor('モデ'));
    expect(await post(fresh, '戻った', 1)).toMatchObject({ type: 'comment' });
  });

  it('低速モードはつなぎごとでなく人ごとに数える', async () => {
    const settings = { ...NO_RULES, slowSeconds: 10, at: clock };
    const first = await connect(CHANNEL, tokenFor('ぴろ', CHANNEL, { settings }));
    expect(await post(first, '1', 1)).toMatchObject({ type: 'comment' });
    clock += 2000;
    const second = await connect(CHANNEL, tokenFor('ぴろ', CHANNEL, { settings }));
    expect(await post(second, '2', 1)).toMatchObject({ type: 'error' });
  });

  it('決まりが変わったら、つないでいる全員に知らせる', async () => {
    const viewer = await connect(CHANNEL, tokenFor('ぴろ'));
    await viewer.nth(1);
    await commandRelay(`ws://localhost:${relay.port()}`, SECRET, CHANNEL, {
      kind: 'settings',
      settings: { ...NO_RULES, slowSeconds: 5, at: clock },
    });
    expect(await viewer.nth(2)).toEqual({ type: 'rules' });
  });

  it('配信者がつないでいなくても、札で教わった配信者の回線は IP で止めない', async () => {
    const sameHomeToken = tokenFor('同じ家', CHANNEL, { ipKey: 'ip-home' });
    const mod = await connect(
      CHANNEL,
      tokenFor('モデ', CHANNEL, { moderator: true, ownerIpKey: 'ip-home' }),
    );
    const family = await connect(CHANNEL, tokenFor('家族', CHANNEL, { ipKey: 'ip-home' }));
    await post(family, 'やあ', 1);
    const toMod = await mod.nth(2);
    mod.socket.send(
      JSON.stringify({ block: toMod.type === 'comment' ? toMod.comment.author : '' }),
    );
    await mod.nth(3);
    clock += 1000;
    const sameHome = await connect(CHANNEL, sameHomeToken);
    expect(await post(sameHome, '書ける', 1)).toMatchObject({ type: 'comment' });
  });
});
