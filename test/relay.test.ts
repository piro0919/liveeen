import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startRelay } from '../relay/relay';
import { guestId, type RelayMessage, TOKEN_EXPIRED } from '@/lib/comment';
import { COMMENT_TOKEN_TTL_MS, signCommentToken } from '@/lib/comment-token';

const SECRET = 'relay-secret';
const CHANNEL = 'abc123';

let relay: ReturnType<typeof startRelay>;
let clock: number;

beforeEach(() => {
  clock = 1_800_000_000_000;
  relay = startRelay({ port: 0, secret: SECRET, now: () => clock });
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

function tokenFor(name: string, channelId = CHANNEL) {
  return signCommentToken(SECRET, channelId, { userId: `id-${name}`, displayName: name }, clock);
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
    expect(await writer.nth(2)).toEqual(got);
    expect(elsewhere.received).toEqual([{ type: 'history', comments: [] }]);
  });

  it('ログインしていない人の札で書いたコメントには guest の印が付く', async () => {
    const guestToken = signCommentToken(
      SECRET,
      CHANNEL,
      { userId: guestId('00000000-0000-4000-8000-000000000000'), displayName: 'ぴろ' },
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

  it('形の合わない名前のチャンネルにはつながせない', async () => {
    const socket = new WebSocket(`ws://localhost:${relay.port()}/a/b`);
    const code = await new Promise<number>((resolve) => socket.once('close', resolve));
    expect(code).toBe(1008);
  });
});
