'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StatusScreen } from '@/components/status-screen';
import { ui } from '@/lib/ui';

/**
 * ページがサーバーかブラウザで落ちたとき。上の帯と下のリンクは残る（外枠ごと落ちたときは global-error.tsx）。
 * 文言は global-error と同じ（messages/ja.json の errorPage）
 */
export default function PageError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errorPage');
  return (
    <StatusScreen title={t('title')} message={t('message')}>
      <button type="button" onClick={reset} className={ui.primaryButton}>
        {t('retry')}
      </button>
      <Link href="/" className={ui.tonalButton}>
        {t('home')}
      </Link>
    </StatusScreen>
  );
}
