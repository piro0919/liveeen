'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { clearAuthCookies, deleteAccount } from '@/lib/account';
import { normalizeDisplayName } from '@/lib/display-name';
import { setEmailsLiveStarted, setListsFollowedOnTop } from '@/lib/follows';
import { normalizeHandle } from '@/lib/handle';
import { kickStream } from '@/lib/live';
import { setDisplayName, setHandle } from '@/lib/profiles';
import {
  deletePushSubscription,
  hasPushSubscription,
  type PushSubscriptionInput,
  savePushSubscription,
} from '@/lib/push';
import { currentUserId } from '@/lib/session';

export async function setListsFollowedOnTopAction(on: boolean): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  await setListsFollowedOnTop(userId, on);
  refresh();
}

export async function setEmailsLiveStartedAction(on: boolean): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  await setEmailsLiveStarted(userId, on);
  refresh();
}

/** 送り口の形。ブラウザから来るものなので、DB に入れる前に確かめる */
const pushSubscriptionInput = z.object({
  endpoint: z.url().startsWith('https://'),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

/** このブラウザでブラウザ通知を受け取る */
export async function savePushSubscriptionAction(input: PushSubscriptionInput): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  await savePushSubscription(userId, pushSubscriptionInput.parse(input));
}

/** このブラウザでブラウザ通知を受け取るのをやめる */
export async function deletePushSubscriptionAction(endpoint: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  await deletePushSubscription(userId, endpoint);
}

/** このブラウザの送り口が、ログインしている人のものとして覚えてあるか */
export async function hasPushSubscriptionAction(endpoint: string): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  return hasPushSubscription(userId, endpoint);
}

/** 名前の欄の結果。使えない名前なら理由を出す */
export type DisplayNameState = { error: string | null; saved: boolean };

export async function setDisplayNameAction(
  _: DisplayNameState,
  form: FormData,
): Promise<DisplayNameState> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  const result = normalizeDisplayName(String(form.get('name') ?? ''));
  if (!result.ok) return { error: result.error, saved: false };
  await setDisplayName(userId, result.name);
  refresh();
  return { error: null, saved: true };
}

/** ハンドルの欄の結果。使えないハンドルなら理由を出す */
export type HandleState = { error: string | null; saved: boolean };

export async function setHandleAction(_: HandleState, form: FormData): Promise<HandleState> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  const result = normalizeHandle(String(form.get('handle') ?? ''));
  if (!result.ok) return { error: result.error, saved: false };
  if ((await setHandle(userId, result.handle)) === 'taken') {
    return { error: 'このハンドルはほかの人が使っています', saved: false };
  }
  refresh();
  return { error: null, saved: true };
}

/** アカウントを消した結果。運営に止められた配信者は消せない（src/lib/account.ts） */
export type DeleteAccountResult = 'deleted' | 'banned';

export async function deleteAccountAction(): Promise<DeleteAccountResult> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  const result = await deleteAccount(userId);
  if (!result.deleted) return 'banned';
  // 消したチャンネルの配信が続いていれば切る。MediaMTX は配信を始めたときにしか聞かないため
  if (result.channelId) await kickStream(result.channelId);
  await clearAuthCookies();
  return 'deleted';
}
