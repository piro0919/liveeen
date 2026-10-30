'use server';

import { randomUUID } from 'node:crypto';
import { refresh } from 'next/cache';
import { channelById } from '@/lib/channels';
import { guestId } from '@/lib/comment';
import { signCommentToken } from '@/lib/comment-token';
import { normalizeDisplayName } from '@/lib/display-name';
import { follow, unfollow } from '@/lib/follows';
import { liveStream, publishing } from '@/lib/live';
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

/** いまの配信を通報する（CLAUDE.md）。ログインが要る。配信1回に1人1件 */
export async function reportAction(channelId: string): Promise<ReportResult> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  const live = await liveStream(channelId);
  if (!live) return 'offline';
  await report(userId, live);
  return 'reported';
}

/**
 * コメントの中継につなぐための札（src/lib/comment-token.ts）。
 * ログインして名前を付けた人には、その名前で出す。
 * ログインしていない人には、配信者が許していて（db/migrations/0006_guest_comments.sql）、その場で入れた名前があるときだけ出す。
 * どれでもなければ null で、読むだけでつなぐ
 */
export async function commentTokenAction(
  channelId: string,
  guestName: string | null,
): Promise<string | null> {
  const secret = env.COMMENT_TOKEN_SECRET;
  if (!secret) return null;
  const userId = await currentUserId();
  if (userId) {
    const displayName = await displayNameOf(userId);
    if (!displayName) return null;
    return signCommentToken(secret, channelId, { userId, displayName }, Date.now());
  }
  if (!guestName) return null;
  const name = normalizeDisplayName(guestName);
  if (!name.ok) return null;
  const channel = await channelById(channelId);
  if (!channel?.guestComments) return null;
  // 未ログインの人には決まった id が無い。札ごとに振る
  const guest = { userId: guestId(randomUUID()), displayName: name.name };
  return signCommentToken(secret, channelId, guest, Date.now());
}

/**
 * その配信が、いま配信サーバーに届いているか。分からなければ null。見るのにログインは要らないので、誰でも聞ける。
 * WebRTC の視聴のつながりが揺れたときに、配信が終わったのかを確かめる
 */
export async function channelPublishingAction(channelId: string): Promise<boolean | null> {
  return publishing(channelId);
}
