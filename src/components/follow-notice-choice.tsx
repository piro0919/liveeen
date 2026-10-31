'use client';

import { useOptimistic, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { setEmailsLiveStartedAction, setListsFollowedOnTopAction } from '@/app/settings/actions';
import { BrowserPushChoice } from './browser-push-choice';
import { safely } from '@/lib/safe-action';
import { ui } from '@/lib/ui';

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
        className={ui.check}
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
  const t = useTranslations('followNotice');
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className={`mb-1 ${ui.subheading}`}>{t('legend')}</legend>
      <SavedCheckbox
        checked={listOnTop}
        save={(on) => safely(() => setListsFollowedOnTopAction(on))}
        label={t('listOnTop')}
      />
      {pushPublicKey && <BrowserPushChoice publicKey={pushPublicKey} />}
      {emailEnabled && (
        <SavedCheckbox
          checked={email}
          save={(on) => safely(() => setEmailsLiveStartedAction(on))}
          label={t('email')}
        />
      )}
    </fieldset>
  );
}
