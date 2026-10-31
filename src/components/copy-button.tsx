'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ui } from '@/lib/ui';

/** 書き写しにくい値（OBS のサーバーの住所や鍵）を、押すだけで写す。写したら短い知らせを出す */
export function CopyButton({ value }: { value: string }) {
  const t = useTranslations('copy');
  const tToast = useTranslations('toast');
  return (
    <button
      type="button"
      className={ui.tonalButton}
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => toast(tToast('copied')),
          () => toast(tToast('copyFailed')),
        );
      }}
    >
      {t('button')}
    </button>
  );
}
