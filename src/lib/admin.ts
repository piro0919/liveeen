import 'server-only';
import { isAdminEmail } from './admin-emails';
import { db } from './db';
import { currentUserId } from './session';
import { env } from '@/env';

/** ログインしている人が運営か（ADMIN_EMAILS） */
export async function isAdmin(): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  const { rows } = await db().query<{ email: string }>('select email from "user" where id = $1', [
    userId,
  ]);
  return rows[0] ? isAdminEmail(env.ADMIN_EMAILS, rows[0].email) : false;
}

/** 運営でなければ止める。管理画面の操作の頭で呼ぶ */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error('運営ではありません');
}

export type BannedChannel = { id: string; displayName: string | null; bannedAt: Date };

/** 止めた配信者のチャンネル。新しく止めた順 */
export async function bannedChannels(): Promise<BannedChannel[]> {
  const { rows } = await db().query<BannedChannel>(
    `select channel.id, profile.display_name as "displayName", channel.banned_at as "bannedAt"
     from channel left join profile on profile.user_id = channel.user_id
     where channel.banned_at is not null
     order by channel.banned_at desc`,
  );
  return rows;
}

/** 配信者を止める（banned）／戻す */
export async function setBanned(channelId: string, banned: boolean): Promise<void> {
  await db().query(
    'update channel set banned_at = case when $2 then now() else null end where id = $1',
    [channelId, banned],
  );
}
