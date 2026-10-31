import 'server-only';
import type { Comment } from './comment';
import { db } from './db';

/** 見る画面に渡す、通報したコメントの数。中継が覚えているコメントの数（relay/relay.ts）と同じ */
const SHOWN_REPORTS = 50;

/** 管理画面に出す、通報されたコメント */
export type ReportedComment = {
  commentId: string;
  channelId: string;
  channelName: string | null;
  handle: string | null;
  name: string;
  guest: boolean;
  text: string;
  commentedAt: Date;
  count: number;
};

/**
 * コメントを通報する（db/migrations/0016_comment_report.sql）。通報されたコメントは、そのときの本文・名前・時刻ごと残す。
 * 同じ人の二度目は数えない。中身が中継の流したものかは、呼ぶ側が先に確かめる。
 * そのコメントへの1件目なら true（運営に知らせる。src/lib/report-notice.ts）
 */
export async function reportComment(
  userId: string,
  channelId: string,
  comment: Pick<Comment, 'id' | 'name' | 'text' | 'at' | 'guest'>,
): Promise<boolean> {
  const { rows } = await db().query<{ first: boolean }>(
    `with saved as (
       insert into reported_comment (comment_id, channel_id, display_name, guest, body, commented_at)
       select $1, id, $3, $4, $5, $6 from channel where id = $2
       on conflict (comment_id) do nothing
       returning 1
     ), reported as (
       insert into comment_report (comment_id, user_id)
       select $1, $7 where exists (select 1 from channel where id = $2)
       on conflict do nothing
       returning 1
     )
     select exists (select 1 from saved) and exists (select 1 from reported) as first`,
    [
      comment.id,
      channelId,
      comment.name,
      comment.guest,
      comment.text,
      new Date(comment.at),
      userId,
    ],
  );
  return rows[0]?.first ?? false;
}

/**
 * その人が通報したコメントの id。見る画面の「通報しました」に使う。
 * 画面に出るのは中継が覚えている直近の分（relay/relay.ts の HISTORY_SIZE）だけなので、新しいほうからその数まで
 */
export async function reportedCommentIdsOf(userId: string, channelId: string): Promise<string[]> {
  const { rows } = await db().query<{ commentId: string }>(
    `select r.comment_id as "commentId" from comment_report r
     join reported_comment c on c.comment_id = r.comment_id
     where r.user_id = $1 and c.channel_id = $2
     order by r.created_at desc limit $3`,
    [userId, channelId, SHOWN_REPORTS],
  );
  return rows.map((row) => row.commentId);
}

/** 通報されて、まだ消していないコメント。通報の多い順、同じ数なら新しく通報された順 */
export async function reportedComments(): Promise<ReportedComment[]> {
  const { rows } = await db().query<ReportedComment>(
    `select c.comment_id as "commentId", c.channel_id as "channelId",
       profile.display_name as "channelName", profile.handle,
       c.display_name as name, c.guest, c.body as text, c.commented_at as "commentedAt",
       count(r.user_id)::int as count
     from reported_comment c
     join comment_report r on r.comment_id = c.comment_id
     join channel on channel.id = c.channel_id
     left join profile on profile.user_id = channel.user_id
     where c.removed_at is null
     group by c.comment_id, profile.display_name, profile.handle
     order by count desc, max(r.created_at) desc`,
  );
  return rows;
}

/** 消した印を付ける。消したものは管理画面に出さない */
export async function markCommentRemoved(commentId: string): Promise<void> {
  await db().query('update reported_comment set removed_at = now() where comment_id = $1', [
    commentId,
  ]);
}

/** 消すコメントのチャンネル。もう消したか、無ければ null */
export async function reportedCommentChannel(commentId: string): Promise<string | null> {
  const { rows } = await db().query<{ channelId: string }>(
    `select channel_id as "channelId" from reported_comment
     where comment_id = $1 and removed_at is null`,
    [commentId],
  );
  return rows[0]?.channelId ?? null;
}
