'use server';

import { refresh } from 'next/cache';
import {
  channelOf,
  createChannel,
  resetStreamKey,
  setGuestComments,
  setLatencyMode,
  setStreamTitle,
} from '@/lib/channels';
import { normalizeStreamTitle } from '@/lib/stream-title';
import { unblockCommenter } from '@/lib/blocks';
import { commandRelay } from '@/lib/comment-removal';
import {
  FOLLOWERS_ONLY_CHOICES,
  parseBlockedWords,
  SLOW_MODE_CHOICES,
} from '@/lib/comment-settings';
import { removeModerator, setCommentSettings } from '@/lib/moderation';
import { isLatencyMode } from '@/lib/latency';
import { publishing } from '@/lib/live';
import { signMediaToken } from '@/lib/media-token';
import { displayNameOf } from '@/lib/profiles';
import { currentUserId } from '@/lib/session';
import { env } from '@/env';

/** 見せる鍵。作ったときと作り直したときの一度だけ返る */
export type KeyState = { key: string | null };

export async function createChannelAction(_: KeyState, form: FormData): Promise<KeyState> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  if (form.get('adult') !== 'yes') throw new Error('18歳以上の申告がありません');
  if (!(await displayNameOf(userId))) throw new Error('名前がありません');
  const key = await createChannel(userId);
  refresh();
  return { key };
}

export async function resetStreamKeyAction(): Promise<KeyState> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  return { key: await resetStreamKey(userId) };
}

/** ブラウザから配信するための札（src/lib/media-token.ts） */
export async function browserPublishTokenAction(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  const channel = await channelOf(userId);
  if (!channel) throw new Error('チャンネルがありません');
  if (!env.MEDIA_TOKEN_SECRET) throw new Error('MEDIA_TOKEN_SECRET がありません');
  return signMediaToken(env.MEDIA_TOKEN_SECRET, channel.id, Date.now());
}

/**
 * 自分の配信が、いま配信サーバーに届いているか。分からなければ null。
 * ブラウザの配信のつながりが揺れたときに、配信サーバーの側で終わっているかを確かめる
 */
export async function publishingAction(): Promise<boolean | null> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  const channel = await channelOf(userId);
  if (!channel) throw new Error('チャンネルがありません');
  return publishing(channel.id);
}

export type StreamTitleState = { error: string | null; saved: boolean };

/** 配信のタイトルを付ける。空なら消す。配信中に変えても、一覧と見る画面には次に開いたときから出る */
export async function setStreamTitleAction(
  _: StreamTitleState,
  form: FormData,
): Promise<StreamTitleState> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  const result = normalizeStreamTitle(String(form.get('title') ?? ''));
  if (!result.ok) return { error: result.error, saved: false };
  await setStreamTitle(userId, result.title);
  refresh();
  return { error: null, saved: true };
}

export async function setGuestCommentsAction(allowed: boolean): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  await setGuestComments(userId, allowed);
  refresh();
}

export type CommentRulesState = { error: string | null; saved: boolean };

/**
 * コメントの決まり（低速モード・フォロワー限定・禁止語）を変える。
 * 中継に送って、つないでいる人にもその場で効かせる。届かなくても、次に札をもらった人から効く
 */
export async function setCommentRulesAction(
  _: CommentRulesState,
  form: FormData,
): Promise<CommentRulesState> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  const slowSeconds = Number(form.get('slow'));
  if (!(SLOW_MODE_CHOICES as readonly number[]).includes(slowSeconds)) {
    throw new Error(`低速モードの選び方が違います: ${String(form.get('slow'))}`);
  }
  const followers = String(form.get('followers') ?? '');
  const followersOnlyMinutes = followers === '' ? null : Number(followers);
  if (!(FOLLOWERS_ONLY_CHOICES as readonly (number | null)[]).includes(followersOnlyMinutes)) {
    throw new Error(`フォロワー限定の選び方が違います: ${followers}`);
  }
  const words = parseBlockedWords(String(form.get('words') ?? ''));
  if (!words.ok) return { error: words.error, saved: false };
  const saved = await setCommentSettings(userId, {
    slowSeconds,
    followersOnlyMinutes,
    blockedWords: words.words,
  });
  if (!saved) throw new Error('チャンネルがありません');
  const secret = env.COMMENT_TOKEN_SECRET;
  if (secret) {
    await commandRelay(env.NEXT_PUBLIC_COMMENT_RELAY_URL, secret, saved.channelId, {
      kind: 'settings',
      settings: saved.settings,
    }).catch(() => {
      // 中継に届かなくても、次に札をもらった人から効く
    });
  }
  refresh();
  return { error: null, saved: true };
}

/** モデレーターを外す。中継に知らせて、その人をつなぎ直させ、その場から外す */
export async function removeModeratorAction(moderatorId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  const channel = await channelOf(userId);
  if (!channel) throw new Error('チャンネルがありません');
  await removeModerator(channel.id, moderatorId);
  const secret = env.COMMENT_TOKEN_SECRET;
  if (secret) {
    await commandRelay(env.NEXT_PUBLIC_COMMENT_RELAY_URL, secret, channel.id, {
      kind: 'roles',
      userId: moderatorId,
    }).catch(() => {
      // 中継に届かなくても、その人が次につなぎ直したときから外れる（遅くとも札の期限の10分）
    });
  }
  refresh();
}

/** コメントでブロックした人を戻す（src/lib/blocks.ts）。次に札をもらうときから書ける */
export async function unblockCommenterAction(blockId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  const channel = await channelOf(userId);
  if (!channel) throw new Error('チャンネルがありません');
  await unblockCommenter(channel.id, blockId);
  refresh();
}

export async function setLatencyModeAction(mode: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  if (!isLatencyMode(mode)) throw new Error(`遅延の選び方が違います: ${mode}`);
  await setLatencyMode(userId, mode);
  refresh();
}
