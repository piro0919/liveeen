import { z } from 'zod';
import { verifyMediaToken } from './media-token';
import { hashStreamKey } from './stream-key';

/**
 * MediaMTX が配信と視聴のたびに送ってくる問い合わせ（authMethod: http）。
 * 形は https://github.com/bluenviron/mediamtx/blob/v1.21.2/docs/2-features/06-authentication.md
 */
export const mediaAuthRequest = z.object({
  user: z.string().default(''),
  password: z.string().default(''),
  token: z.string().default(''),
  action: z.string(),
  path: z.string().default(''),
  protocol: z.string().default(''),
  query: z.string().default(''),
});

export type MediaAuthRequest = z.infer<typeof mediaAuthRequest>;

/** 配信の名前として受け付ける形。チャンネルの id（db/migrations/0002_channels.sql）は、この形で作る */
const PATH_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * 配信者が渡してくるもの。渡し方は道具ごとに違う。
 * - OBS の WHIP：Bearer の token に配信の鍵
 * - ブラウザ（配信の画面）：Bearer の token に期限付きの札（src/lib/media-token.ts）
 * - OBS の RTMP：配信の名前の後ろの ?key=…（OBS の「ストリームキー」欄に `<id>?key=<鍵>` と入れる）
 * - RTMP で user と pass を付ける道具：password
 */
function credentialOf(request: MediaAuthRequest): string {
  if (request.token) return request.token;
  const fromQuery = new URLSearchParams(request.query).get('key');
  if (fromQuery) return fromQuery;
  return request.password;
}

export type MediaAuthDeps = {
  /** 配信の名前と鍵の組が、登録されたチャンネルのものか */
  channelKeyMatches: (channelId: string, streamKeyHash: string) => Promise<boolean>;
  /** 運営が止めた配信者のチャンネルか（db/migrations/0009_ban.sql）。止めたチャンネルは鍵が合っても通さない */
  channelBanned: (channelId: string) => Promise<boolean>;
  /** ブラウザの札の署名の鍵。無ければ札は通さない */
  tokenSecret: string | undefined;
  now: number;
};

/**
 * 通すかどうか。配信は鍵か札が合い、運営が止めていないチャンネルだけ。
 * 視聴は、形の合う名前なら誰でも（見るのにログインは要らない）。
 * それ以外（録画の再生・API など）は通さない
 */
export async function allowMedia(
  request: MediaAuthRequest,
  { channelKeyMatches, channelBanned, tokenSecret, now }: MediaAuthDeps,
): Promise<boolean> {
  if (!PATH_PATTERN.test(request.path)) return false;
  if (request.action === 'read') return true;
  if (request.action !== 'publish') return false;
  const credential = credentialOf(request);
  if (!credential) return false;
  if (await channelBanned(request.path)) return false;
  // 配信の鍵は `.` を含まない（src/lib/stream-key.ts）ので、含むものは札として確かめる
  if (credential.includes('.')) {
    return (
      tokenSecret !== undefined && verifyMediaToken(tokenSecret, credential, request.path, now)
    );
  }
  return channelKeyMatches(request.path, hashStreamKey(credential));
}
