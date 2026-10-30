import { describe, expect, it } from 'vitest';
import { allowMedia, mediaAuthRequest } from '@/lib/media-auth';
import { hashStreamKey } from '@/lib/stream-key';

const CHANNEL = 'abc123';
const KEY = 'secret-key';

/** CHANNEL と KEY の組だけが登録されている DB の代わり */
async function registered(channelId: string, streamKeyHash: string) {
  return channelId === CHANNEL && streamKeyHash === hashStreamKey(KEY);
}

function req(fields: Record<string, string>) {
  return mediaAuthRequest.parse(fields);
}

describe('allowMedia', () => {
  it('WHIP の Bearer で鍵が合えば配信を通す', async () => {
    expect(
      await allowMedia(req({ action: 'publish', path: CHANNEL, token: KEY }), registered),
    ).toBe(true);
  });

  it('RTMP の ?key= で鍵が合えば配信を通す', async () => {
    expect(
      await allowMedia(req({ action: 'publish', path: CHANNEL, query: `key=${KEY}` }), registered),
    ).toBe(true);
  });

  it('password で鍵が合えば配信を通す', async () => {
    expect(
      await allowMedia(req({ action: 'publish', path: CHANNEL, password: KEY }), registered),
    ).toBe(true);
  });

  it('鍵が違えば配信を断る', async () => {
    expect(
      await allowMedia(req({ action: 'publish', path: CHANNEL, token: 'wrong' }), registered),
    ).toBe(false);
  });

  it('鍵が無ければ配信を断る', async () => {
    expect(await allowMedia(req({ action: 'publish', path: CHANNEL }), registered)).toBe(false);
  });

  it('ほかのチャンネルの名前には、自分の鍵で配信できない', async () => {
    expect(
      await allowMedia(req({ action: 'publish', path: 'other', token: KEY }), registered),
    ).toBe(false);
  });

  it('視聴は鍵なしで通す', async () => {
    expect(await allowMedia(req({ action: 'read', path: CHANNEL }), registered)).toBe(true);
  });

  it('形の合わない名前は視聴も断る', async () => {
    expect(await allowMedia(req({ action: 'read', path: 'a/b' }), registered)).toBe(false);
  });

  it('録画の再生や API は断る', async () => {
    expect(await allowMedia(req({ action: 'playback', path: CHANNEL }), registered)).toBe(false);
    expect(await allowMedia(req({ action: 'api', path: CHANNEL }), registered)).toBe(false);
  });
});
