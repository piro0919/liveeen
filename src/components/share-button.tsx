'use client';

import { useTranslations } from 'next-intl';
import { useShare } from '@/lib/use-share';
import { ui } from '@/lib/ui';
import { ShareIcon } from './nav-icons';

/** 配信の住所を広めるボタン。path を渡さなければ、いま開いているページの住所 */
export function ShareButton({ title, path }: { title: string; path?: string }) {
  const t = useTranslations('share');
  const share = useShare();

  return (
    // 手本は YouTube と Twitch：字のないアイコン
    <button
      type="button"
      className={ui.iconButton}
      aria-label={t('button')}
      onClick={() => void share(title, path)}
    >
      <ShareIcon />
    </button>
  );
}
