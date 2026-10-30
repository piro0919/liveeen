import 'server-only';
import { db } from './db';
import { withoutDelisted } from './delist';
import { type LivePath, livePathsOf } from './live-paths';
import { reportersOf } from './reports';
import { env } from '@/env';

/** 配信サーバーが答えないとき、トップを待たせる上限 */
const API_TIMEOUT_MS = 3000;
/** 一度に読む配信の数。MediaMTX の既定は100件で切れる */
const ITEMS_PER_PAGE = 1000;

/** 配信中のチャンネル。名前は配信者が付けたもの。名前より先に作られたチャンネルは null */
export type LiveChannel = LivePath & { displayName: string | null };

/** 配信サーバー（MediaMTX）の API を読む。答えなければ null */
async function mediaApi(path: string): Promise<unknown> {
  return fetch(`${env.MEDIA_API_URL}${path}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })
    .then(async (response) => (response.ok ? ((await response.json()) as unknown) : null))
    .catch(() => null);
}

/** そのチャンネルのいまの配信。配信していなければ null */
export async function liveStream(channelId: string): Promise<LivePath | null> {
  const item = await mediaApi(`/v3/paths/get/${encodeURIComponent(channelId)}`);
  return livePathsOf({ items: item ? [item] : [] })[0] ?? null;
}

/**
 * いま配信中のチャンネル。配信中かどうかは配信サーバー（MediaMTX）の API に聞き、
 * 登録されたチャンネルのものだけを残す。通報でしきい値に届いた配信は除く（src/lib/delist.ts）。
 * 配信サーバーが答えなければ空の一覧
 */
export async function liveChannels(): Promise<LiveChannel[]> {
  const paths = livePathsOf(await mediaApi(`/v3/paths/list?itemsPerPage=${ITEMS_PER_PAGE}`));
  if (paths.length === 0) return [];
  const { rows } = await db().query<{ id: string; displayName: string | null }>(
    `select channel.id, profile.display_name as "displayName"
     from channel left join profile on profile.user_id = channel.user_id
     where channel.id = any($1)`,
    [paths.map((path) => path.channelId)],
  );
  const names = new Map(rows.map((row) => [row.id, row.displayName]));
  const registered = paths.filter((path) => names.has(path.channelId));
  return withoutDelisted(registered, await reportersOf(registered)).map((path) => ({
    ...path,
    displayName: names.get(path.channelId) ?? null,
  }));
}
