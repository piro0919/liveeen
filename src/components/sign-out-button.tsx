'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { signOut } from '@/lib/auth-client';
import { ui } from '@/lib/ui';

/** ログアウト。終わったらトップへ戻る（設定の画面はログインしていないと中身が無いため） */
export function SignOutButton() {
  const router = useRouter();
  const [signingOut, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={ui.tonalButton}
      disabled={signingOut}
      onClick={() =>
        startTransition(async () => {
          await signOut();
          router.push('/');
          // 上の帯の「配信する」と人の印を、ログインしていない形に描き直す
          router.refresh();
        })
      }
    >
      ログアウト
    </button>
  );
}
