'use server';

import { refresh } from 'next/cache';
import { requireAdmin, setBanned } from '@/lib/admin';
import { markCommentRemoved, reportedCommentChannel } from '@/lib/comment-reports';
import { removeFromRelay } from '@/lib/comment-removal';
import { kickStream } from '@/lib/live';
import { env } from '@/env';

/** いまの配信のつなぎを切る。配信者はつなぎ直せる */
export async function stopStreamAction(channelId: string): Promise<void> {
  await requireAdmin();
  await kickStream(channelId);
  refresh();
}

/** 配信者を止める。いまの配信も切る */
export async function banAction(channelId: string): Promise<void> {
  await requireAdmin();
  await setBanned(channelId, true);
  await kickStream(channelId);
  refresh();
}

export async function unbanAction(channelId: string): Promise<void> {
  await requireAdmin();
  await setBanned(channelId, false);
  refresh();
}

/** 通報されたコメントを消す。中継に知らせて全員の画面から消し、管理画面からも外す */
export async function removeCommentAction(commentId: string): Promise<void> {
  await requireAdmin();
  const secret = env.COMMENT_TOKEN_SECRET;
  if (!secret) throw new Error('COMMENT_TOKEN_SECRET がありません');
  const channelId = await reportedCommentChannel(commentId);
  if (!channelId) return;
  await removeFromRelay(env.NEXT_PUBLIC_COMMENT_RELAY_URL, secret, channelId, commentId);
  await markCommentRemoved(commentId);
  refresh();
}
