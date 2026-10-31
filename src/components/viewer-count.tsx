'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';

/**
 * チャンネルごとの、見ている人の数と、映像が流れているか。
 * 数はコメントの中継から届き（src/components/comments.tsx）、映像はプレーヤーが知っている（src/components/player.tsx）。
 * どちらも同じ画面の別の部品にあるので、ここに置いて人数の表示と分け合う
 */
const viewers = new Map<string, number>();
const playing = new Map<string, boolean>();
const listeners = new Set<() => void>();

function changed(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 中継から届いた人数。つなぎが切れたら null で消す */
export function setViewers(channelId: string, count: number | null): void {
  if (count === null) viewers.delete(channelId);
  else viewers.set(channelId, count);
  changed();
}

/** プレーヤーが映像を流しているか */
export function setPlaying(channelId: string, on: boolean): void {
  playing.set(channelId, on);
  changed();
}

type Props = {
  channelId: string;
  /** 映像が流れているときだけ出す（見る画面）。配信者の画面は配信中にしか出さないので要らない */
  whilePlaying?: boolean;
  className?: string;
};

/** 見ている人の数。中継から数が届くまでは何も出さない */
export function ViewerCount({ channelId, whilePlaying = false, className }: Props) {
  const t = useTranslations('viewers');
  const count = useSyncExternalStore(
    subscribe,
    () => viewers.get(channelId) ?? null,
    () => null,
  );
  const shown = useSyncExternalStore(
    subscribe,
    () => !whilePlaying || playing.get(channelId) === true,
    () => false,
  );
  if (count === null || !shown) return null;
  return <span className={className}>{t('count', { count })}</span>;
}
