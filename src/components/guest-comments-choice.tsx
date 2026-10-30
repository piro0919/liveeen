'use client';

import { useOptimistic, useTransition } from 'react';
import { setGuestCommentsAction } from '@/app/broadcast/actions';

/**
 * ログインしていない人がコメントを書けるか。選んだその場で保存する。
 * 見ている人には、次につなぎ直したときから効く（遅くとも10分。src/components/comments.tsx）
 */
export function GuestCommentsChoice({ allowed }: { allowed: boolean }) {
  const [saving, startTransition] = useTransition();
  // 保存が終わるのを待たずに、押したほうへ印を動かす
  const [shown, setShown] = useOptimistic(allowed);
  return (
    <fieldset className="flex flex-col gap-1" disabled={saving}>
      <legend className="font-bold">コメント</legend>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={shown}
          onChange={(event) => {
            const next = event.target.checked;
            startTransition(async () => {
              setShown(next);
              await setGuestCommentsAction(next);
            });
          }}
        />
        ログインしていない人もコメントできる
      </label>
    </fieldset>
  );
}
