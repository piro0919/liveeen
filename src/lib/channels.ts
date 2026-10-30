import 'server-only';
import { db } from './db';
import type { LatencyMode } from './latency';
import { hashStreamKey, newChannelId, newStreamKey } from './stream-key';

export type Channel = { id: string; latencyMode: LatencyMode };

const CHANNEL_COLUMNS = 'id, latency_mode as "latencyMode"';

/** その人のチャンネル。まだ作っていなければ null */
export async function channelOf(userId: string): Promise<Channel | null> {
  const { rows } = await db().query<Channel>(
    `select ${CHANNEL_COLUMNS} from channel where user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

/** id からチャンネル。無ければ null */
export async function channelById(id: string): Promise<Channel | null> {
  const { rows } = await db().query<Channel>(
    `select ${CHANNEL_COLUMNS} from channel where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * チャンネルを作り、配信の鍵を返す。18歳以上の申告を受けたときだけ呼ぶ（CLAUDE.md）。
 * 既にあれば作らず null（鍵は DB に SHA-256 でしか無いので、二度は見せられない）
 */
export async function createChannel(userId: string): Promise<string | null> {
  const key = newStreamKey();
  const { rowCount } = await db().query(
    `insert into channel (id, user_id, stream_key_hash, adult_declared_at)
     values ($1, $2, $3, now())
     on conflict (user_id) do nothing`,
    [newChannelId(), userId, hashStreamKey(key)],
  );
  return rowCount === 1 ? key : null;
}

/** 配信の鍵を作り直して返す。前の鍵は使えなくなる */
export async function resetStreamKey(userId: string): Promise<string | null> {
  const key = newStreamKey();
  const { rowCount } = await db().query(
    'update channel set stream_key_hash = $2 where user_id = $1',
    [userId, hashStreamKey(key)],
  );
  return rowCount === 1 ? key : null;
}

export async function setLatencyMode(userId: string, mode: LatencyMode): Promise<void> {
  await db().query('update channel set latency_mode = $2 where user_id = $1', [userId, mode]);
}
