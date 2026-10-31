'use server';

import { randomUUID } from 'node:crypto';
import { refresh } from 'next/cache';
import { blockCommenter, commenterBlocked } from '@/lib/blocks';
import { channelById, channelOf } from '@/lib/channels';
import { type Comment, guestId } from '@/lib/comment';
import { reportComment } from '@/lib/comment-reports';
import { signCommentToken, verifyAuthor, verifyCommentProof } from '@/lib/comment-token';
import { requestIpKey } from '@/lib/request-ip';
import { normalizeDisplayName } from '@/lib/display-name';
import { follow, unfollow } from '@/lib/follows';
import { liveStream, publishing } from '@/lib/live';
import { isReportReason } from '@/lib/report-reason';
import { report } from '@/lib/reports';
import { displayNameOf } from '@/lib/profiles';
import { currentUserId } from '@/lib/session';
import { env } from '@/env';

/** フォローする（on）／やめる。ログインが要る */
export async function setFollowingAction(channelId: string, on: boolean): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  if (on) await follow(userId, channelId);
  else await unfollow(userId, channelId);
  refresh();
}

/** 通報の結果。配信していなければ数える配信が無い */
export type ReportResult = 'reported' | 'offline';

/** いまの配信を通報する（CLAUDE.md）。ログインが要る。配信1回に1人1件。理由は選んでもらう */
export async function reportAction(channelId: string, reason: string): Promise<ReportResult> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  if (!isReportReason(reason)) throw new Error(`通報の理由が違います: ${reason}`);
  const live = await liveStream(channelId);
  if (!live) return 'offline';
  await report(userId, live, reason);
  return 'reported';
}

/** コメントの札。token が null なら読むだけでつなぐ。blocked は配信者に止められていること */
export type CommentTokenResult = { token: string | null; blocked: boolean };

const READ_ONLY: CommentTokenResult = { token: null, blocked: false };

/**
 * コメントの中継につなぐための札（src/lib/comment-token.ts）。
 * ログインして名前を付けた人には、その名前で出す。
 * ログインしていない人には、配信者が許していて（db/migrations/0006_guest_comments.sql）、その場で入れた名前があるときだけ出す。
 * 配信者が止めた人には出さない（src/lib/blocks.ts）。配信者自身は止められない
 */
export async function commentTokenAction(
  channelId: string,
  guestName: string | null,
): Promise<CommentTokenResult> {
  const secret = env.COMMENT_TOKEN_SECRET;
  if (!secret) return READ_ONLY;
  const ipKey = await requestIpKey(secret);
  const userId = await currentUserId();
  if (userId) {
    const displayName = await displayNameOf(userId);
    if (!displayName) return READ_ONLY;
    const owner = (await channelOf(userId))?.id === channelId;
    if (!owner && (await commenterBlocked(channelId, userId, ipKey))) {
      return { token: null, blocked: true };
    }
    const commenter = { userId, displayName, ipKey, owner };
    return { token: signCommentToken(secret, channelId, commenter, Date.now()), blocked: false };
  }
  if (!guestName) return READ_ONLY;
  const name = normalizeDisplayName(guestName);
  if (!name.ok) return READ_ONLY;
  const channel = await channelById(channelId);
  if (!channel?.guestComments) return READ_ONLY;
  if (await commenterBlocked(channelId, null, ipKey)) return { token: null, blocked: true };
  // 未ログインの人には決まった id が無い。札ごとに振る
  const guest = { userId: guestId(randomUUID()), displayName: name.name, ipKey, owner: false };
  return { token: signCommentToken(secret, channelId, guest, Date.now()), blocked: false };
}

/**
 * コメントした人を止める。配信者だけができる。author は中継がコメントに付けた札（src/lib/comment-token.ts）。
 * 中継にも見る画面から知らせ、その場で書けなくする（relay/relay.ts）
 */
export async function blockCommenterAction(channelId: string, author: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  if ((await channelOf(userId))?.id !== channelId)
    throw new Error('自分のチャンネルではありません');
  const secret = env.COMMENT_TOKEN_SECRET;
  if (!secret) throw new Error('COMMENT_TOKEN_SECRET がありません');
  const verified = verifyAuthor(secret, author, channelId);
  if (!verified) throw new Error('書いた人の札が合いません');
  if (verified.userId === userId) throw new Error('自分は止められません');
  await blockCommenter(channelId, verified, await requestIpKey(secret));
}

/**
 * その配信が、いま配信サーバーに届いているか。分からなければ null。見るのにログインは要らないので、誰でも聞ける。
 * WebRTC の視聴のつながりが揺れたときに、配信が終わったのかを確かめる
 */
export async function channelPublishingAction(channelId: string): Promise<boolean | null> {
  return publishing(channelId);
}

/** 通報するコメント。中継が流したそのまま（src/lib/comment.ts） */
type ReportedCommentInput = Pick<Comment, 'id' | 'name' | 'text' | 'at' | 'guest' | 'proof'>;

/**
 * コメントを通報する。ログインが要る。1つのコメントに1人1件。
 * 中身が中継の流したものと同じかを印で確かめ（src/lib/comment-token.ts）、通報されたものだけ保存する
 */
export async function reportCommentAction(
  channelId: string,
  comment: ReportedCommentInput,
): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  const secret = env.COMMENT_TOKEN_SECRET;
  if (!secret) throw new Error('COMMENT_TOKEN_SECRET がありません');
  const shown = {
    id: String(comment.id),
    name: String(comment.name),
    text: String(comment.text),
    at: Number(comment.at),
    guest: comment.guest === true,
  };
  if (!comment.proof || !verifyCommentProof(secret, channelId, shown, String(comment.proof))) {
    throw new Error('コメントの印が合いません');
  }
  await reportComment(userId, channelId, shown);
}
