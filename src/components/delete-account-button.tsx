'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteAccountAction } from '@/app/settings/actions';
import { ui } from '@/lib/ui';

/** アカウントを消す。確かめてから消し、トップへ戻る。運営に止められた配信者は消せない（src/lib/account.ts） */
export function DeleteAccountButton() {
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
          if (
            !window.confirm(
              'アカウントを消しますか？チャンネル、フォロー、設定もすべて消え、元に戻せません',
            )
          )
            return;
          startTransition(async () => {
            const result = await deleteAccountAction().catch(() => null);
            if (result === 'deleted') {
              router.push('/');
              // 上の帯を、ログインしていない形に描き直す
              router.refresh();
              return;
            }
            setError(
              result === 'banned'
                ? '運営が配信を止めているため、ここでは消せません。プライバシーポリシーの問い合わせ先へご連絡ください'
                : 'アカウントを消せませんでした。もう一度押してください',
            );
          });
        }}
      >
        アカウントを消す
      </button>
      {error && <p className={ui.error}>{error}</p>}
    </div>
  );
}
