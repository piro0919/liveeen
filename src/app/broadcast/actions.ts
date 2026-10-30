'use server';

import { refresh } from 'next/cache';
import { channelOf, createChannel, resetStreamKey, setLatencyMode } from '@/lib/channels';
import { isLatencyMode } from '@/lib/latency';
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

export async function setLatencyModeAction(mode: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  if (!isLatencyMode(mode)) throw new Error(`遅延の選び方が違います: ${mode}`);
  await setLatencyMode(userId, mode);
  refresh();
}
