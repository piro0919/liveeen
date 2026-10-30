import 'server-only';
import { isGuestId } from './comment';
import type { Author } from './comment-token';
import { db } from './db';

/** 配信者が止めた人（/broadcast の一覧） */
export type CommentBlock = { id: string; displayName: string; createdAt: Date };

/**
 * コメントした人を止める（db/migrations/0015_comment_block.sql）。
 * ログインした人は id と IP、ゲストは IP で止める。
 * 配信者と同じ回線の人を IP で止めると、配信者の家族まで書けなくなるので、そのときは id だけで止める（中継と同じ。relay/relay.ts）。
 * IP で止められないゲストは止められないので、false を返す
 */
export async function blockCommenter(
  channelId: string,
  author: Author,
  ownerIpKey: string | null,
): Promise<boolean> {
  const userId = isGuestId(author.userId) ? null : author.userId;
  const ipKey = author.ipKey === ownerIpKey ? null : author.ipKey;
  if (!userId && !ipKey) return false;
  await db().query(
    `insert into comment_block (channel_id, user_id, ip_key, display_name) values ($1, $2, $3, $4)`,
    [channelId, userId, ipKey, author.displayName],
  );
  return true;
}

/** 止めたのを戻す。そのチャンネルのものだけ */
export async function unblockCommenter(channelId: string, blockId: string): Promise<void> {
  await db().query('delete from comment_block where id = $1 and channel_id = $2', [
    blockId,
    channelId,
  ]);
}

/** その人がそのチャンネルで止められているか。ゲストは IP だけで見る */
export async function commenterBlocked(
  channelId: string,
  userId: string | null,
  ipKey: string | null,
): Promise<boolean> {
  const { rowCount } = await db().query(
    `select 1 from comment_block
     where channel_id = $1 and (user_id = $2 or ip_key = $3) limit 1`,
    [channelId, userId, ipKey],
  );
  return (rowCount ?? 0) > 0;
}

/** そのチャンネルで止めた人。新しい順 */
export async function blocksOf(channelId: string): Promise<CommentBlock[]> {
  const { rows } = await db().query<CommentBlock>(
    `select id::text, display_name as "displayName", created_at as "createdAt"
     from comment_block where channel_id = $1 order by created_at desc`,
    [channelId],
  );
  return rows;
}
