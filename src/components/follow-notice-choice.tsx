'use client';

import { useOptimistic, useTransition } from 'react';
import { setEmailsLiveStartedAction, setListsFollowedOnTopAction } from '@/app/settings/actions';
import { BrowserPushChoice } from './browser-push-choice';

/** 選んだその場で保存する切り替え。保存が終わるのを待たずに、押したほうへ印を動かす */
function SavedCheckbox({
  checked,
  save,
  label,
}: {
  checked: boolean;
  save: (on: boolean) => Promise<void>;
  label: string;
}) {
  const [saving, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(checked);
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={shown}
        disabled={saving}
        onChange={(event) => {
          const next = event.target.checked;
          startTransition(async () => {
            setShown(next);
            await save(next);
          });
        }}
      />
      {label}
    </label>
  );
}

/**
 * フォローした人が配信を始めたときの知らせ方（CLAUDE.md）。トップの上に出すか、ブラウザ通知、メール。
 * VAPID の公開の鍵が無い環境ではブラウザ通知の、メールを送る用意が無い環境ではメールの切り替えを出さない
 */
export function FollowNoticeChoice({
  listOnTop,
  email,
  emailEnabled,
  pushPublicKey,
}: {
  listOnTop: boolean;
  email: boolean;
  emailEnabled: boolean;
  pushPublicKey: string | undefined;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-bold">フォローした人の配信</legend>
      <SavedCheckbox
        checked={listOnTop}
        save={setListsFollowedOnTopAction}
        label="トップの上に出す"
      />
      {pushPublicKey && <BrowserPushChoice publicKey={pushPublicKey} />}
      {emailEnabled && (
        <SavedCheckbox checked={email} save={setEmailsLiveStartedAction} label="メールで知らせる" />
      )}
    </fieldset>
  );
}
