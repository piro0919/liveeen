'use client';

import dynamic from 'next/dynamic';
import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { usePwa } from 'use-pwa';
import { installChoice, isAppleDevice } from '@/lib/install';
import { ui } from '@/lib/ui';

const PWAPrompt = dynamic(() => import('react-ios-pwa-prompt'), { ssr: false });

/** 案内の板を出すまで待つ時間（ミリ秒）。押してすぐ出すと、押した操作の続きで閉じることがある（vocafy と同じ） */
const PROMPT_DELAY_MS = 100;

function noop() {
  return () => {};
}

/** 端末の判定は window を見る。サーバー側では決まらないので、載ってから読む */
export function useIsAppleDevice(): boolean {
  return useSyncExternalStore(
    noop,
    () => isAppleDevice(navigator.userAgent, navigator.maxTouchPoints),
    () => false,
  );
}

/**
 * 設定の「アプリ」の欄（vocafy・鯉魂と同じ形）。ホーム画面に置けば、すぐ開けて、iPhone でも通知が届く。
 * 追加できる端末で、まだ入れていないときだけ出す
 */
export function InstallApp() {
  const t = useTranslations('installApp');
  const { canInstall, install, isInstalled } = usePwa();
  const isApple = useIsAppleDevice();
  const [guide, setGuide] = useState(false);
  const choice = installChoice({ canInstall, isInstalled, isApple });
  if (!choice) return null;
  return (
    <div className={ui.card}>
      <h2 className={ui.subheading}>{t('heading')}</h2>
      <p className={ui.note}>{t('description')}</p>
      <button
        type="button"
        className={ui.tonalButton}
        onClick={() => (choice === 'prompt' ? void install() : setGuide(true))}
      >
        {t('button')}
      </button>
      {choice === 'guide' &&
        createPortal(
          <PWAPrompt
            isShown={guide}
            onClose={() => setGuide(false)}
            appIconPath="/apple-icon.png"
            copyTitle={t('button')}
            copyDescription={t('description')}
            copyShareStep={t('guideShare')}
            copyAddToHomeScreenStep={t('guideAdd')}
            delay={PROMPT_DELAY_MS}
          />,
          document.body,
        )}
    </div>
  );
}
