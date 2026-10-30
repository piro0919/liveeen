'use client';

import { useOptimistic, useTransition } from 'react';
import { setFollowingAction } from '@/app/[channelId]/actions';
import { signIn } from '@/lib/auth-client';

type Props = {
  channelId: string;
  /** フォローしているか。ログインしていなければ null */
  following: boolean | null;
};

/** フォローの切り替え。押したその場で保存する。ログインしていなければ、押すとログインへ */
export function FollowButton({ channelId, following }: Props) {
  const [saving, startTransition] = useTransition();
  // 保存が終わるのを待たずに、押したほうへ表示を変える
  const [shown, setShown] = useOptimistic(following ?? false);
  return (
    <button
      type="button"
      className="self-start rounded border px-4 py-2"
      disabled={saving}
      aria-pressed={shown}
      onClick={() => {
        if (following === null) {
          void signIn();
          return;
        }
        startTransition(async () => {
          setShown(!shown);
          await setFollowingAction(channelId, !shown);
        });
      }}
    >
      {shown ? 'フォロー中' : 'フォローする'}
    </button>
  );
}
