'use server';

import { refresh } from 'next/cache';
import { normalizeDisplayName } from '@/lib/display-name';
import { setDisplayName } from '@/lib/profiles';
import { currentUserId } from '@/lib/session';

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
