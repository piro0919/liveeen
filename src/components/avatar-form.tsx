'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { setAvatarChoiceAction, uploadAvatarAction } from '@/app/settings/actions';
import type { AvatarChoice } from '@/lib/avatar';
import { shrinkAvatarImage } from '@/lib/avatar-image';
import { ui } from '@/lib/ui';
import { Avatar } from './avatar';

type Props = {
  name: string;
  src: string | null;
  choice: AvatarChoice;
  hasGoogleImage: boolean;
};

/**
 * 人の丸い印（アイコン）を変える欄。既定は Google の写真で、画像をアップロードするか、名前の1文字に戻せる。
 * Google の写真は顔や本名が写っていることがあるので、ほかの人に見えることを書いておく
 */
export function AvatarForm({ name, src, choice, hasGoogleImage }: Props) {
  const t = useTranslations('avatarForm');
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <span className={ui.subheading}>{t('label')}</span>
      <span className={ui.note}>{t('description')}</span>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={name} src={src} size="lg" />
        <label
          className={`${ui.tonalButton} cursor-pointer has-disabled:cursor-default has-disabled:opacity-50`}
        >
          {t('pick')}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={saving}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // 同じ画像を選び直しても、また変化として受け取れるように空にしておく
              event.target.value = '';
              if (!file) return;
              startTransition(async () => {
                const image = await shrinkAvatarImage(file);
                if (!image) {
                  setError(t('unusable'));
                  return;
                }
                const form = new FormData();
                form.set('image', image);
                setError((await uploadAvatarAction(form)).error);
              });
            }}
          />
        </label>
        {choice !== 'google' && hasGoogleImage && (
          <button
            type="button"
            className={ui.tonalButton}
            disabled={saving}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                await setAvatarChoiceAction('google');
              })
            }
          >
            {t('useGoogle')}
          </button>
        )}
        {choice !== 'initial' && (
          <button
            type="button"
            className={ui.tonalButton}
            disabled={saving}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                await setAvatarChoiceAction('initial');
              })
            }
          >
            {t('useInitial')}
          </button>
        )}
      </div>
      {error && <p className={ui.error}>{error}</p>}
    </div>
  );
}
