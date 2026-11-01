'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

/**
 * 住所を広める（vocafy・鯉魂の共有と同じ考え）。スマホは端末の共有の画面（LINE や X へ送れる）を開き、
 * それが無いパソコンでは住所を写す。共有の画面を閉じただけ（AbortError）は何も出さない。
 * path を渡さなければ、いま開いているページの住所
 */
export function useShare() {
  const t = useTranslations('toast');

  return async function share(title: string, path?: string) {
    const url = path ? new URL(path, location.origin).href : location.href.split('?')[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          toast(t('shareFailed'));
        }
      }
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => toast(t('linkCopied')),
      () => toast(t('copyFailed')),
    );
  };
}
