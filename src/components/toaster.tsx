'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Toaster as Sonner, toast } from 'sonner';
import { ACTION_FAILED_EVENT } from '@/lib/safe-action';
import { ui } from '@/lib/ui';

/**
 * 一瞬だけ出す知らせ（「コピーしました」、操作が届かなかったとき）。Sonner を使う（vocafy・spatto と同じ）。
 * スマホの下はコメントの書く欄があるので、上に出す。見た目は設定のまとまりと同じ面
 */
export function Toaster() {
  const t = useTranslations('toast');

  // 操作が届かなかったら知らせる（src/lib/safe-action.ts）
  useEffect(() => {
    const failed = () => toast(t('actionFailed'));
    window.addEventListener(ACTION_FAILED_EVENT, failed);
    return () => window.removeEventListener(ACTION_FAILED_EVENT, failed);
  }, [t]);

  return (
    <Sonner
      position="top-center"
      duration={3000}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: ui.toast,
        },
      }}
    />
  );
}
