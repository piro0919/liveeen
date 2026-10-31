'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { signOut } from '@/lib/auth-client';
import { ui } from '@/lib/ui';

/** ログアウト。終わったらトップへ戻る（設定の画面はログインしていないと中身が無いため） */
export function SignOutButton() {
  const t = useTranslations('signOut');
  const router = useRouter();
  const [signingOut, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={ui.tonalButton}
        disabled={signingOut}
        onClick={() =>
          startTransition(async () => {
            // 失敗しても投げずに error を返すので、見てから進む
            const { error } = await signOut().catch(() => ({ error: true }));
            setFailed(Boolean(error));
            if (error) return;
            router.push('/');
            // 上の帯の「配信する」と人の印を、ログインしていない形に描き直す
            router.refresh();
          })
        }
      >
        {t('button')}
      </button>
      {failed && <p className={ui.error}>{t('failed')}</p>}
    </div>
  );
}
