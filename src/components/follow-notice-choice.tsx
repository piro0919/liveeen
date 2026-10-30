'use client';

import { useOptimistic, useTransition } from 'react';
import { setListsFollowedOnTopAction } from '@/app/settings/actions';
import { BrowserPushChoice } from './browser-push-choice';

/**
 * フォローした人が配信を始めたときの知らせ方。選んだその場で保存する。
 * トップの上に出すかと、ブラウザ通知。メールは作るときにここへ足す（CLAUDE.md）。
 * VAPID の公開の鍵が無い環境では、ブラウザ通知の切り替えを出さない
 */
export function FollowNoticeChoice({
  listOnTop,
  pushPublicKey,
}: {
  listOnTop: boolean;
  pushPublicKey: string | undefined;
}) {
  const [saving, startTransition] = useTransition();
  // 保存が終わるのを待たずに、押したほうへ印を動かす
  const [shown, setShown] = useOptimistic(listOnTop);
  return (
    <fieldset className="flex flex-col gap-1" disabled={saving}>
      <legend className="font-bold">フォローした人の配信</legend>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={shown}
          onChange={(event) => {
            const next = event.target.checked;
            startTransition(async () => {
              setShown(next);
              await setListsFollowedOnTopAction(next);
            });
          }}
        />
        トップの上に出す
      </label>
      {pushPublicKey && <BrowserPushChoice publicKey={pushPublicKey} />}
    </fieldset>
  );
}
