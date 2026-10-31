import 'server-only';
import type { CommentSettings } from './comment-settings';
import { db } from './db';

/**
 * そのチャンネルのコメントの決まり（db/migrations/0018_comment_moderation.sql）。チャンネルが無ければ null。
 * 数の列は bigint なので int に直して読む
 */
export async function commentSettingsOf(channelId: string): Promise<CommentSettings | null> {
  const { rows } = await db().query<{
    slowSeconds: number;
    blockedWords: string[];
    followersOnlyMinutes: number | null;
    at: Date;
  }>(
    `select slow_mode_seconds::int as "slowSeconds", blocked_words as "blockedWords",
       followers_only_minutes::int as "followersOnlyMinutes", comment_settings_at as "at"
     from channel where id = $1`,
    [channelId],
  );
  const row = rows[0];
  return row ? { ...row, at: row.at.getTime() } : null;
}

/** コメントの札を作るのに要る、チャンネルの側のこと。1度の問い合わせで読む */
export type CommentContext = {
  settings: CommentSettings;
  /** 配信者の利用者の id */
  ownerId: string;
  /** 配信者がコメントにつないだときの IP の鍵。まだなら null */
  ownerIpKey: string | null;
  guestComments: boolean;
};

export async function commentContextOf(channelId: string): Promise<CommentContext | null> {
  const { rows } = await db().query<{
    slowSeconds: number;
    blockedWords: string[];
    followersOnlyMinutes: number | null;
    at: Date;
    ownerId: string;
    ownerIpKey: string | null;
    guestComments: boolean;
  }>(
    `select slow_mode_seconds::int as "slowSeconds", blocked_words as "blockedWords",
       followers_only_minutes::int as "followersOnlyMinutes", comment_settings_at as "at",
       user_id as "ownerId", owner_ip_key as "ownerIpKey", guest_comments as "guestComments"
     from channel where id = $1`,
    [channelId],
  );
  const row = rows[0];
  if (!row) return null;
  const { ownerId, ownerIpKey, guestComments, at, ...settings } = row;
  return { settings: { ...settings, at: at.getTime() }, ownerId, ownerIpKey, guestComments };
}

/** 配信者がコメントの決まりを変える。変えた時刻を進め、新しい決まりを返す（中継へ送る） */
export async function setCommentSettings(
  userId: string,
  settings: Omit<CommentSettings, 'at'>,
): Promise<{ channelId: string; settings: CommentSettings } | null> {
  const { rows } = await db().query<{ id: string; at: Date }>(
    `update channel set slow_mode_seconds = $2, blocked_words = $3, followers_only_minutes = $4,
       comment_settings_at = now()
     where user_id = $1 returning id, comment_settings_at as "at"`,
    [userId, settings.slowSeconds, settings.blockedWords, settings.followersOnlyMinutes],
  );
  const row = rows[0];
  return row ? { channelId: row.id, settings: { ...settings, at: row.at.getTime() } } : null;
}

/** 配信者がコメントにつないだときの IP の鍵を覚える。モデレーターのブロックで、配信者と同じ回線の人を IP で止めないため */
export async function rememberOwnerIpKey(channelId: string, ipKey: string | null): Promise<void> {
  await db().query('update channel set owner_ip_key = $2 where id = $1', [channelId, ipKey]);
}

export async function ownerIpKeyOf(channelId: string): Promise<string | null> {
  const { rows } = await db().query<{ ipKey: string | null }>(
    'select owner_ip_key as "ipKey" from channel where id = $1',
    [channelId],
  );
  return rows[0]?.ipKey ?? null;
}

/** モデレーター（/broadcast の一覧）。名前はいまの表示名 */
export type Moderator = { userId: string; displayName: string | null; createdAt: Date };

export async function isModerator(channelId: string, userId: string): Promise<boolean> {
  const { rowCount } = await db().query(
    'select 1 from channel_moderator where channel_id = $1 and user_id = $2',
    [channelId, userId],
  );
  return rowCount === 1;
}

/** モデレーターにする。もうなっていれば何もしない。配信者自身はならない */
export async function addModerator(channelId: string, userId: string): Promise<void> {
  await db().query(
    `insert into channel_moderator (channel_id, user_id)
     select id, $2 from channel where id = $1 and user_id <> $2
     on conflict do nothing`,
    [channelId, userId],
  );
}

export async function removeModerator(channelId: string, userId: string): Promise<void> {
  await db().query('delete from channel_moderator where channel_id = $1 and user_id = $2', [
    channelId,
    userId,
  ]);
}

/** そのチャンネルのモデレーター。新しい順 */
export async function moderatorsOf(channelId: string): Promise<Moderator[]> {
  const { rows } = await db().query<Moderator>(
    `select channel_moderator.user_id as "userId", profile.display_name as "displayName",
       channel_moderator.created_at as "createdAt"
     from channel_moderator left join profile on profile.user_id = channel_moderator.user_id
     where channel_moderator.channel_id = $1 order by channel_moderator.created_at desc`,
    [channelId],
  );
  return rows;
}
