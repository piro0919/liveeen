'use server';

import { randomUUID } from 'node:crypto';
import { refresh } from 'next/cache';
import { channelById } from '@/lib/channels';
import { signCommentToken } from '@/lib/comment-token';
import { normalizeDisplayName } from '@/lib/display-name';
import { follow, unfollow } from '@/lib/follows';
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
  const guest = { userId: `guest:${randomUUID()}`, displayName: name.name };
  return signCommentToken(secret, channelId, guest, Date.now());
}
