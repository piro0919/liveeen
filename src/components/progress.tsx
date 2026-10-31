'use client';

import { ProgressProvider } from '@bprogress/next/app';
import type { ReactNode } from 'react';

/**
 * ページを移るあいだ、画面の上端に差し色の細い線を出す（@bprogress/next、vocafy と同じ形）。回る印は出さない。
 * 拾えるのはリンクを押したときだけで、コードから移るとき（ログアウト・アカウントを消す）には出ない
 */
export function Progress({ children }: { children: ReactNode }) {
  return (
    <ProgressProvider height="2px" color="var(--accent-fill)" options={{ showSpinner: false }}>
      {children}
    </ProgressProvider>
  );
}
