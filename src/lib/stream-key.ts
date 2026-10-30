import { createHash } from 'node:crypto';

/** DB に持つ形の配信の鍵（db/migrations/0002_channels.sql） */
export function hashStreamKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
