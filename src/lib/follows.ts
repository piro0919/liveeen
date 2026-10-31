import 'server-only';
import { db } from './db';

/** そのチャンネルをフォローしているか */
export async function isFollowing(userId: string, channelId: string): Promise<boolean> {
  const { rowCount } = await db().query(
    'select 1 from follow where user_id = $1 and channel_id = $2',
    [userId, channelId],
  );
  return rowCount === 1;
}

/** そのチャンネルをフォローした時刻（ミリ秒）。していなければ null。フォロワー限定のコメントに使う */
export async function followedAtOf(userId: string, channelId: string): Promise<number | null> {
  const { rows } = await db().query<{ createdAt: Date }>(
    'select created_at as "createdAt" from follow where user_id = $1 and channel_id = $2',
    [userId, channelId],
  );
  return rows[0]?.createdAt.getTime() ?? null;
}

/** フォローする。自分のチャンネルはフォローできない */
export async function follow(userId: string, channelId: string): Promise<void> {
  await db().query(
    `insert into follow (user_id, channel_id)
     select $1, id from channel where id = $2 and user_id <> $1
     on conflict do nothing`,
    [userId, channelId],
  );
}

export async function unfollow(userId: string, channelId: string): Promise<void> {
  await db().query('delete from follow where user_id = $1 and channel_id = $2', [
    userId,
    channelId,
  ]);
}

/** 渡したチャンネルのうち、フォローしているもの */
export async function followedAmong(userId: string, channelIds: string[]): Promise<Set<string>> {
  if (channelIds.length === 0) return new Set();
  const { rows } = await db().query<{ channelId: string }>(
    'select channel_id as "channelId" from follow where user_id = $1 and channel_id = any($2)',
    [userId, channelIds],
  );
  return new Set(rows.map((row) => row.channelId));
}

/** フォロー中の配信をトップの上に出すか。設定していなければ出す */
export async function listsFollowedOnTop(userId: string): Promise<boolean> {
  const { rows } = await db().query<{ listOnTop: boolean }>(
    'select list_on_top as "listOnTop" from notification_setting where user_id = $1',
    [userId],
  );
  return rows[0]?.listOnTop ?? true;
}

/** フォローした人の配信の始まりをメールで知らせるか。設定していなければ知らせない */
export async function emailsLiveStarted(userId: string): Promise<boolean> {
  const { rows } = await db().query<{ email: boolean }>(
    'select email from notification_setting where user_id = $1',
    [userId],
  );
  return rows[0]?.email ?? false;
}

export async function setEmailsLiveStarted(userId: string, on: boolean): Promise<void> {
  await db().query(
    `insert into notification_setting (user_id, email) values ($1, $2)
     on conflict (user_id) do update set email = excluded.email`,
    [userId, on],
  );
}

export async function setListsFollowedOnTop(userId: string, on: boolean): Promise<void> {
  await db().query(
    `insert into notification_setting (user_id, list_on_top) values ($1, $2)
     on conflict (user_id) do update set list_on_top = excluded.list_on_top`,
    [userId, on],
  );
}
