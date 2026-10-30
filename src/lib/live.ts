import 'server-only';
import { db } from './db';
import { type LivePath, livePathsOf } from './live-paths';
import { env } from '@/env';

/** 配信サーバーが答えないとき、トップを待たせる上限 */
const API_TIMEOUT_MS = 3000;
/** 一度に読む配信の数。MediaMTX の既定は100件で切れる */
const ITEMS_PER_PAGE = 1000;

/**
 * いま配信中のチャンネル。配信中かどうかは配信サーバー（MediaMTX）の API に聞き、
 * 登録されたチャンネルのものだけを残す。配信サーバーが答えなければ空の一覧
 */
export async function liveChannels(): Promise<LivePath[]> {
  const paths = await fetch(`${env.MEDIA_API_URL}/v3/paths/list?itemsPerPage=${ITEMS_PER_PAGE}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })
    .then(async (response) => (response.ok ? livePathsOf(await response.json()) : []))
    .catch(() => []);
  if (paths.length === 0) return [];
  const { rows } = await db().query<{ id: string }>('select id from channel where id = any($1)', [
    paths.map((path) => path.channelId),
  ]);
  const registered = new Set(rows.map((row) => row.id));
  return paths.filter((path) => registered.has(path.channelId));
}
