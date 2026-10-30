import 'server-only';
import { z } from 'zod';
import { db } from './db';
import { withoutDelisted } from './delist';
import { kickPath } from './kick';
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
 * いま配信中の、登録されたチャンネル。配信中かどうかは配信サーバー（MediaMTX）の API に聞く。
 * 運営が止めたチャンネルは除く。配信サーバーが答えなければ空の一覧。
 * 通報で外した配信も含む（管理画面はこれを見る）
 */
export async function liveRegisteredChannels(): Promise<LiveChannel[]> {
  const paths = livePathsOf(await mediaApi(`/v3/paths/list?itemsPerPage=${ITEMS_PER_PAGE}`));
  if (paths.length === 0) return [];
  const { rows } = await db().query<{ id: string; displayName: string | null }>(
    `select channel.id, profile.display_name as "displayName"
     from channel left join profile on profile.user_id = channel.user_id
     where channel.id = any($1) and channel.banned_at is null`,
    [paths.map((path) => path.channelId)],
  );
  const names = new Map(rows.map((row) => [row.id, row.displayName]));
  return paths
    .filter((path) => names.has(path.channelId))
    .map((path) => ({ ...path, displayName: names.get(path.channelId) ?? null }));
}

/** トップに出す、いま配信中のチャンネル。通報でしきい値に届いた配信は除く（src/lib/delist.ts） */
export async function liveChannels(): Promise<LiveChannel[]> {
  const channels = await liveRegisteredChannels();
  return withoutDelisted(channels, await reportersOf(channels));
}

const NOT_FOUND = 404;

/**
 * そのチャンネルの配信が、いま配信サーバーに届いているか。配信サーバーが答えなければ null（分からない）。
 * 配信していない名前には、MediaMTX は 404 を返す
 */
export async function publishing(channelId: string): Promise<boolean | null> {
  const response = await fetch(
    `${env.MEDIA_API_URL}/v3/paths/get/${encodeURIComponent(channelId)}`,
    { cache: 'no-store', signal: AbortSignal.timeout(API_TIMEOUT_MS) },
  ).catch(() => null);
  if (response?.status === NOT_FOUND) return false;
  if (!response?.ok) return null;
  return livePathsOf({ items: [await response.json()] }).length > 0;
}

const pathSource = z.object({
  source: z.object({ type: z.string(), id: z.string() }).nullable(),
});

/**
 * いまの配信のつなぎを切る（管理画面の「配信を止める」）。切れたら true。
 * 配信者はすぐつなぎ直せるので、二度と配信させないときは配信者を止める（db/migrations/0009_ban.sql）
 */
export async function kickStream(channelId: string): Promise<boolean> {
  const parsed = pathSource.safeParse(
    await mediaApi(`/v3/paths/get/${encodeURIComponent(channelId)}`),
  );
  const source = parsed.success ? parsed.data.source : null;
  const path = source ? kickPath(source) : null;
  if (!path) return false;
  const response = await fetch(`${env.MEDIA_API_URL}${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  }).catch(() => null);
  return response?.ok ?? false;
}
