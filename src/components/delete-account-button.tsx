'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { deleteAccountAction } from '@/app/settings/actions';
import { ui } from '@/lib/ui';

/** アカウントを消す。確かめてから消し、トップへ戻る。運営に止められた配信者は消せない（src/lib/account.ts） */
export function DeleteAccountButton() {
  const t = useTranslations('deleteAccount');
  const router = useRouter();
  const [deleting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        className={ui.textButton}
        disabled={deleting}
        onClick={() => {
          if (!window.confirm(t('confirm'))) return;
          startTransition(async () => {
            const result = await deleteAccountAction().catch(() => null);
            if (result === 'deleted') {
              router.push('/');
              // 上の帯を、ログインしていない形に描き直す
              router.refresh();
              return;
            }
            setError(result === 'banned' ? t('errors.banned') : t('errors.failed'));
          });
        }}
      >
        {t('button')}
      </button>
      {error && <p className={ui.error}>{error}</p>}
    </div>
  );
}
