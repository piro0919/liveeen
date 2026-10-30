'use server';

import { refresh } from 'next/cache';
import { requireAdmin, setBanned } from '@/lib/admin';
import { kickStream } from '@/lib/live';

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
