'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ui } from '@/lib/ui';

/**
 * 配信の住所を広める（vocafy・鯉魂の共有と同じ考え）。スマホは端末の共有の画面（LINE や X へ送れる）を開き、
 * それが無いパソコンでは住所を写す。共有の画面を閉じただけ（AbortError）は何も出さない
 */
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations('share');
  const tToast = useTranslations('toast');

  async function share() {
    const url = location.href.split('?')[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          toast(tToast('shareFailed'));
        }
      }
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => toast(tToast('linkCopied')),
      () => toast(tToast('copyFailed')),
    );
  }

  return (
    <button type="button" className={ui.tonalButton} onClick={() => void share()}>
      {t('button')}
    </button>
  );
}
