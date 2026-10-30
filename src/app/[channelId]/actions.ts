'use server';

import { signCommentToken } from '@/lib/comment-token';
import { displayNameOf } from '@/lib/profiles';
import { currentUserId } from '@/lib/session';
import { env } from '@/env';

/**
 * コメントの中継につなぐための札（src/lib/comment-token.ts）。
 * ログインして名前を付けた人にだけ出す。ほかの人は null で、読むだけでつなぐ
 */
export async function commentTokenAction(channelId: string): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId || !env.COMMENT_TOKEN_SECRET) return null;
  const displayName = await displayNameOf(userId);
  if (!displayName) return null;
  return signCommentToken(env.COMMENT_TOKEN_SECRET, channelId, { userId, displayName }, Date.now());
}
