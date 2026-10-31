'use client';

import { useOptimistic, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { setFollowingAction } from '@/app/[channelId]/actions';
import { signIn } from '@/lib/auth-client';
import { safely } from '@/lib/safe-action';
import { ui } from '@/lib/ui';

type Props = {
  channelId: string;
  /** フォローしているか。ログインしていなければ null */
  following: boolean | null;
};

/** フォローの切り替え。押したその場で保存する。ログインしていなければ、押すとログインへ */
export function FollowButton({ channelId, following }: Props) {
  const t = useTranslations('follow');
  const [saving, startTransition] = useTransition();
  // 保存が終わるのを待たずに、押したほうへ表示を変える
  const [shown, setShown] = useOptimistic(following ?? false);
  return (
    <button
      type="button"
      // フォロー中は控えめな形にする（YouTube の「チャンネル登録」と「登録済み」）
      className={shown ? ui.tonalButton : ui.primaryButton}
      disabled={saving}
      aria-pressed={shown}
      onClick={() => {
        if (following === null) {
          void signIn();
          return;
        }
        startTransition(async () => {
          setShown(!shown);
          await safely(() => setFollowingAction(channelId, !shown));
        });
      }}
    >
      {shown ? t('following') : t('follow')}
    </button>
  );
}
