import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { StatusScreen } from '@/components/status-screen';
import { ui } from '@/lib/ui';

/**
 * 見つからないページ（打ち間違い、変えた前のハンドル、消したアカウントの住所）。
 * これが無いと Next.js の英語の素の画面が出る（onigiri・vocafy と同じく自前で出す）。文言は仮
 */
export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <StatusScreen title={t('title')} message={t('message')}>
      <Link href="/" className={ui.primaryButton}>
        {t('home')}
      </Link>
    </StatusScreen>
  );
}
