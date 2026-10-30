import { describe, expect, it } from 'vitest';
import { allowMedia, mediaAuthRequest, type MediaAuthDeps } from '@/lib/media-auth';
import { MEDIA_TOKEN_TTL_MS, signMediaToken } from '@/lib/media-token';
import { hashStreamKey } from '@/lib/stream-key';

const CHANNEL = 'abc123';
const KEY = 'secret-key';
const SECRET = 'token-secret';
const NOW = 1_800_000_000_000;

/** CHANNEL と KEY の組だけが登録されている DB の代わり */
const deps: MediaAuthDeps = {
  channelKeyMatches: async (channelId, streamKeyHash) =>
    channelId === CHANNEL && streamKeyHash === hashStreamKey(KEY),
  channelBanned: async () => false,
  tokenSecret: SECRET,
  now: NOW,
};

function req(fields: Record<string, string>) {
  return mediaAuthRequest.parse(fields);
}

describe('allowMedia', () => {
  it('WHIP の Bearer で鍵が合えば配信を通す', async () => {
    expect(await allowMedia(req({ action: 'publish', path: CHANNEL, token: KEY }), deps)).toBe(
      true,
    );
  });

  it('RTMP の ?key= で鍵が合えば配信を通す', async () => {
    expect(
      await allowMedia(req({ action: 'publish', path: CHANNEL, query: `key=${KEY}` }), deps),
    ).toBe(true);
  });

  it('password で鍵が合えば配信を通す', async () => {
    expect(await allowMedia(req({ action: 'publish', path: CHANNEL, password: KEY }), deps)).toBe(
      true,
    );
  });

  it('鍵が違えば配信を断る', async () => {
    expect(await allowMedia(req({ action: 'publish', path: CHANNEL, token: 'wrong' }), deps)).toBe(
      false,
    );
  });

  it('鍵が無ければ配信を断る', async () => {
    expect(await allowMedia(req({ action: 'publish', path: CHANNEL }), deps)).toBe(false);
  });

  it('ほかのチャンネルの名前には、自分の鍵で配信できない', async () => {
    expect(await allowMedia(req({ action: 'publish', path: 'other', token: KEY }), deps)).toBe(
      false,
    );
  });

  it('期限の内の札なら配信を通す', async () => {
    const token = signMediaToken(SECRET, CHANNEL, NOW);
    expect(await allowMedia(req({ action: 'publish', path: CHANNEL, token }), deps)).toBe(true);
  });

  it('期限の切れた札は断る', async () => {
    const token = signMediaToken(SECRET, CHANNEL, NOW - MEDIA_TOKEN_TTL_MS - 1);
    expect(await allowMedia(req({ action: 'publish', path: CHANNEL, token }), deps)).toBe(false);
  });

  it('ほかのチャンネルの札は断る', async () => {
    const token = signMediaToken(SECRET, 'other', NOW);
    expect(await allowMedia(req({ action: 'publish', path: CHANNEL, token }), deps)).toBe(false);
  });

  it('違う鍵で署名した札は断る', async () => {
    const token = signMediaToken('another-secret', CHANNEL, NOW);
    expect(await allowMedia(req({ action: 'publish', path: CHANNEL, token }), deps)).toBe(false);
  });

  it('署名の鍵が設定されていなければ札は断る', async () => {
    const token = signMediaToken(SECRET, CHANNEL, NOW);
    expect(
      await allowMedia(req({ action: 'publish', path: CHANNEL, token }), {
        ...deps,
        tokenSecret: undefined,
      }),
    ).toBe(false);
  });

  it('運営が止めたチャンネルは、鍵でも札でも配信を断る', async () => {
    const banned = { ...deps, channelBanned: async (id: string) => id === CHANNEL };
    const token = signMediaToken(SECRET, CHANNEL, NOW);
    expect(await allowMedia(req({ action: 'publish', path: CHANNEL, token: KEY }), banned)).toBe(
      false,
    );
    expect(await allowMedia(req({ action: 'publish', path: CHANNEL, token }), banned)).toBe(false);
  });

  it('視聴は鍵なしで通す', async () => {
    expect(await allowMedia(req({ action: 'read', path: CHANNEL }), deps)).toBe(true);
  });

  it('形の合わない名前は視聴も断る', async () => {
    expect(await allowMedia(req({ action: 'read', path: 'a/b' }), deps)).toBe(false);
  });

  it('録画の再生や API は断る', async () => {
    expect(await allowMedia(req({ action: 'playback', path: CHANNEL }), deps)).toBe(false);
    expect(await allowMedia(req({ action: 'api', path: CHANNEL }), deps)).toBe(false);
  });
});
