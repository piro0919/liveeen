import { createHash, randomBytes } from 'node:crypto';

/** 配信の鍵の長さ（バイト）。当て推量で当たらない長さにする */
const KEY_BYTES = 32;

/** チャンネルの id の長さ（バイト）。配信の名前と住所に出るので短めにする */
const CHANNEL_ID_BYTES = 9;

/**
 * 新しい配信の鍵。配信者に見せるのは作ったときの一度だけで、DB には hashStreamKey の結果を入れる。
 * 形は `.` を含まない（src/lib/media-auth.ts が、`.` を含むものをブラウザの札として見分ける）
 */
export function newStreamKey(): string {
  return randomBytes(KEY_BYTES).toString('base64url');
}

/** 新しいチャンネルの id。src/lib/media-auth.ts の受け付ける形（英数字と - と _）になる */
export function newChannelId(): string {
  return randomBytes(CHANNEL_ID_BYTES).toString('base64url');
}

/** DB に持つ形の配信の鍵（db/migrations/0002_channels.sql） */
export function hashStreamKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
