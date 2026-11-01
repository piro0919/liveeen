import 'server-only';
import { AVATAR_COLUMNS, type AvatarRow, avatarJoin, avatarOfRow } from './avatars';
import { db } from './db';
import type { LatencyMode } from './latency';
import { likePattern } from './search';
import { hashStreamKey, newChannelId, newStreamKey } from './stream-key';

/**
 * handle は配信者のハンドル（db/migrations/0012_handle.sql）、displayName は配信者の名前。
 * まだ選んでいなければ null
 */
export type Channel = {
  id: string;
  latencyMode: LatencyMode;
  guestComments: boolean;
  handle: string | null;
  displayName: string | null;
  /** 配信のタイトル（db/migrations/0017_stream_title.sql）。付けていなければ null */
  title: string | null;
  /** 配信者の印の画像（src/lib/avatar.ts）。null なら名前の1文字 */
  avatar: string | null;
  /**
   * 前回の配信が始まった時刻。配信の始まりを知らせた時刻（src/lib/notify.ts）を流用する。
   * 10分以内に始め直した配信では動かないので、「3日前」のように大まかに出す用途に限る。配信したことがなければ null
   */
  lastLiveAt: Date | null;
};

const SELECT_CHANNEL = `select channel.id, channel.latency_mode as "latencyMode", channel.title,
  channel.notified_at as "lastLiveAt",
  channel.guest_comments as "guestComments", profile.handle, profile.display_name as "displayName",
  ${AVATAR_COLUMNS}
  from channel left join profile on profile.user_id = channel.user_id
  ${avatarJoin('channel.user_id')}`;

type ChannelRow = Omit<Channel, 'avatar'> & AvatarRow;

function channelOfRow({ googleImage, avatarChoice, avatarKey, ...channel }: ChannelRow): Channel {
  return { ...channel, avatar: avatarOfRow({ googleImage, avatarChoice, avatarKey }) };
}

async function selectChannel(where: string, value: string): Promise<Channel | null> {
  const { rows } = await db().query<ChannelRow>(`${SELECT_CHANNEL} where ${where}`, [value]);
  return rows[0] ? channelOfRow(rows[0]) : null;
}

/** その人のチャンネル。まだ作っていなければ null */
export async function channelOf(userId: string): Promise<Channel | null> {
  return selectChannel('channel.user_id = $1', userId);
}

/** id からチャンネル。無ければ null */
export async function channelById(id: string): Promise<Channel | null> {
  return selectChannel('channel.id = $1', id);
}

/** ハンドルからチャンネル。無ければ null（ハンドルだけ選んでチャンネルをまだ作っていない人も null） */
export async function channelByHandle(handle: string): Promise<Channel | null> {
  return selectChannel('profile.handle = $1', handle);
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

/** 配信のタイトル。null で消す（src/lib/stream-title.ts で整えてから渡す） */
export async function setStreamTitle(userId: string, title: string | null): Promise<void> {
  await db().query('update channel set title = $2 where user_id = $1', [userId, title]);
}

/** ログインしていない人がコメントを書けるか（db/migrations/0006_guest_comments.sql） */
export async function setGuestComments(userId: string, allowed: boolean): Promise<void> {
  await db().query('update channel set guest_comments = $2 where user_id = $1', [userId, allowed]);
}

/** 一覧の1行に出す配信者（検索・フォロー中） */
export type ChannelSummary = Pick<Channel, 'id' | 'handle' | 'displayName' | 'title' | 'avatar'>;

type ChannelSummaryRow = Omit<ChannelSummary, 'avatar'> & AvatarRow;

const SELECT_SUMMARY = `select channel.id, channel.title, profile.handle,
  profile.display_name as "displayName", ${AVATAR_COLUMNS}
  from channel left join profile on profile.user_id = channel.user_id
  ${avatarJoin('channel.user_id')}`;

function summaryOfRow({
  googleImage,
  avatarChoice,
  avatarKey,
  ...channel
}: ChannelSummaryRow): ChannelSummary {
  return { ...channel, avatar: avatarOfRow({ googleImage, avatarChoice, avatarKey }) };
}

/** 一度に出す検索の結果の数 */
const SEARCH_LIMIT = 30;

/**
 * 配信者を、名前・ハンドル・タイトルに言葉を含むかで探す。運営が止めたチャンネルは出さない。
 * ハンドルがそのまま一致する人を先頭にする
 */
export async function searchChannels(query: string): Promise<ChannelSummary[]> {
  const { rows } = await db().query<ChannelSummaryRow>(
    `${SELECT_SUMMARY}
     where channel.banned_at is null
       and (profile.display_name ilike $1 or profile.handle ilike $1 or channel.title ilike $1)
     order by lower(profile.handle) = lower($2) desc nulls last, profile.display_name, channel.id
     limit ${SEARCH_LIMIT}`,
    [likePattern(query), query],
  );
  return rows.map(summaryOfRow);
}

/** その人がフォローしている配信者。新しくフォローした順。運営が止めたチャンネルは出さない */
export async function followedChannels(userId: string): Promise<ChannelSummary[]> {
  const { rows } = await db().query<ChannelSummaryRow>(
    `${SELECT_SUMMARY}
     join follow on follow.channel_id = channel.id and follow.user_id = $1
     where channel.banned_at is null
     order by follow.created_at desc`,
    [userId],
  );
  return rows.map(summaryOfRow);
}

/** 検索に知らせる配信者のページ（src/app/sitemap.ts）。ハンドルを選んでいて、運営が止めていないチャンネル */
export async function listedChannels(): Promise<{ id: string; handle: string }[]> {
  const { rows } = await db().query<{ id: string; handle: string }>(
    `select channel.id, profile.handle
     from channel join profile on profile.user_id = channel.user_id
     where profile.handle is not null and channel.banned_at is null
     order by channel.id`,
  );
  return rows;
}
