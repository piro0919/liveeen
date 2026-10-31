'use server';

import { getTranslations } from 'next-intl/server';
import { refresh } from 'next/cache';
import { z } from 'zod';
import { clearAuthCookies, deleteAccount } from '@/lib/account';
import { AVATAR_IMAGE_MAX_BYTES, sniffAvatarImage } from '@/lib/avatar';
import { saveAvatarImage, setAvatarChoice } from '@/lib/avatars';
import { DISPLAY_NAME_MAX, normalizeDisplayName } from '@/lib/display-name';
import { setEmailsLiveStarted, setListsFollowedOnTop } from '@/lib/follows';
import { HANDLE_MAX, HANDLE_MIN, normalizeHandle } from '@/lib/handle';
import { kickStream } from '@/lib/live';
import { isPushServiceEndpoint } from '@/lib/push-message';
import { setDisplayName, setHandle } from '@/lib/profiles';
import { withinLimit } from '@/lib/rate-limit';
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
  // ブラウザ各社の通知の仕組みの住所だけ（src/lib/push-message.ts）
  endpoint: z.url().refine(isPushServiceEndpoint),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

/** このブラウザでブラウザ通知を受け取る */
export async function savePushSubscriptionAction(input: PushSubscriptionInput): Promise<true> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  await savePushSubscription(userId, pushSubscriptionInput.parse(input));
  return true;
}

/** このブラウザでブラウザ通知を受け取るのをやめる */
export async function deletePushSubscriptionAction(endpoint: string): Promise<true> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  await deletePushSubscription(userId, endpoint);
  return true;
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
  if (!result.ok) {
    const t = await getTranslations('displayName.errors');
    return { error: t(result.error, { max: DISPLAY_NAME_MAX }), saved: false };
  }
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
  const t = await getTranslations('handle.errors');
  if (!result.ok) {
    return { error: t(result.error, { min: HANDLE_MIN, max: HANDLE_MAX }), saved: false };
  }
  if ((await setHandle(userId, result.handle)) === 'taken') {
    return { error: t('taken'), saved: false };
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
  // チャンネルが消えると管理画面から止められなくなるので、切れなければもう1度だけ頼む（配信していなくても false が返る）
  if (result.channelId && !(await kickStream(result.channelId))) await kickStream(result.channelId);
  await clearAuthCookies();
  return 'deleted';
}

/** 印の欄の結果。使えない画像なら理由を出す */
export type AvatarState = { error: string | null };

/**
 * 印にする画像を受け取る。ブラウザで 256 px 四方に縮めてから送ってくる（src/components/avatar-form.tsx）。
 * 種類は中身の頭で見分け、ブラウザの言う種類は信じない
 */
export async function uploadAvatarAction(form: FormData): Promise<AvatarState> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  const file = form.get('image');
  const t = await getTranslations('avatarForm');
  if (!(file instanceof File)) return { error: t('missing') };
  if (file.size > AVATAR_IMAGE_MAX_BYTES) return { error: t('tooLarge') };
  const image = Buffer.from(await file.arrayBuffer());
  const contentType = sniffAvatarImage(image);
  if (!contentType) return { error: t('unusable') };
  if (!(await withinLimit(userId, 'avatarUpload'))) return { error: t('tooMany') };
  await saveAvatarImage(userId, contentType, image);
  refresh();
  return { error: null };
}

/** 印を Google の写真か名前の1文字に戻す。アップロードした画像は消す */
export async function setAvatarChoiceAction(choice: 'google' | 'initial'): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  await setAvatarChoice(userId, choice === 'initial' ? 'initial' : 'google');
  refresh();
}
