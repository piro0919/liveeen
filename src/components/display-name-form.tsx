'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { setDisplayNameAction, type DisplayNameState } from '@/app/settings/actions';
import { DISPLAY_NAME_MAX } from '@/lib/display-name';
import { guarded } from '@/lib/safe-action';
import { ui } from '@/lib/ui';

const INITIAL: DisplayNameState = { error: null, saved: false };

/**
 * 人前に出す名前を付ける欄。配信の一覧とコメントに出る。
 * まだ付けていない人には、配信やコメントの前にこの欄を出す
 */
export function DisplayNameForm({ name }: { name: string | null }) {
  const t = useTranslations('displayNameForm');
  const tForm = useTranslations('form');
  const [state, save, saving] = useActionState(guarded(setDisplayNameAction), INITIAL);
  return (
    <form action={save} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className={ui.subheading}>{t('label')}</span>
        <span className={ui.note}>{t('description', { max: DISPLAY_NAME_MAX })}</span>
        <input
          name="name"
          defaultValue={name ?? ''}
          required
          className={ui.input}
          autoComplete="nickname"
        />
      </label>
      {state.error && <p className={ui.error}>{state.error}</p>}
      {state.saved && !state.error && <p className={ui.note}>{tForm('saved')}</p>}
      <button type="submit" className={`self-start ${ui.primaryButton}`} disabled={saving}>
        {tForm('save')}
      </button>
    </form>
  );
}
