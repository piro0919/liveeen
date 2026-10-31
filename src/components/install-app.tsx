'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { usePwa } from 'use-pwa';
import { installChoice } from '@/lib/install';
import { ui } from '@/lib/ui';

const PWAPrompt = dynamic(() => import('react-ios-pwa-prompt'), { ssr: false });

/** 案内の板を出すまで待つ時間（ミリ秒）。押してすぐ出すと、押した操作の続きで閉じることがある（vocafy と同じ） */
const PROMPT_DELAY_MS = 100;

/** 案内の板が開いている間、本文のスクロールを止める印（react-ios-pwa-prompt の CSS モジュールの名前） */
const NO_SCROLL_PREFIX = '_noScroll_';

/**
 * 設定の「アプリ」の欄（vocafy・鯉魂と同じ形）。ホーム画面に置けば、すぐ開けて、iPhone でも通知が届く。
 * 追加できる端末で、まだ入れていないときだけ出す
 */
export function InstallApp() {
  const t = useTranslations('installApp');
  const { canInstall, install, isInstalled, needsManualInstall } = usePwa();
  const [dismissed, setDismissed] = useState(false);
  const [guide, setGuide] = useState(false);
  // 案内の部品は、出すたびに訪問回数を localStorage に書く（読み書きを try で包んでいない）。押されるまで載せない
  const [guideMounted, setGuideMounted] = useState(false);
  const choice = installChoice({ canInstall, isInstalled, needsManualInstall, dismissed });

  // 案内の部品は、自分の閉じる操作でしかスクロールの止めを外さない。開いたまま画面を離れたら、ここで外す
  useEffect(
    () => () => {
      for (const name of [...document.body.classList]) {
        if (name.startsWith(NO_SCROLL_PREFIX)) document.body.classList.remove(name);
      }
    },
    [],
  );

  if (!choice) return null;
  return (
    <div className={ui.card}>
      <h2 className={ui.subheading}>{t('heading')}</h2>
      <p className={ui.note}>{t('description')}</p>
      <button
        type="button"
        className={ui.tonalButton}
        onClick={() => {
          if (choice === 'guide') {
            setGuideMounted(true);
            setGuide(true);
            return;
          }
          void install().then((result) => {
            if (result?.outcome === 'dismissed') setDismissed(true);
          });
        }}
      >
        {t('button')}
      </button>
      {choice === 'guide' &&
        guideMounted &&
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
