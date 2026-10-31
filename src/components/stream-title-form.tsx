'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { setStreamTitleAction, type StreamTitleState } from '@/app/broadcast/actions';
import { STREAM_TITLE_MAX } from '@/lib/stream-title';
import { guarded } from '@/lib/safe-action';
import { ui } from '@/lib/ui';

const INITIAL: StreamTitleState = { error: null, saved: false };

/** 配信のタイトルを付ける欄（/broadcast と /broadcast/obs）。トップの一覧と見る画面に出る */
export function StreamTitleForm({ title }: { title: string | null }) {
  const t = useTranslations('streamTitleForm');
  const tForm = useTranslations('form');
  const [state, save, saving] = useActionState(guarded(setStreamTitleAction), INITIAL);
  return (
    <form action={save} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className={ui.subheading}>{t('label')}</span>
        <span className={ui.note}>{t('description', { max: STREAM_TITLE_MAX })}</span>
        <input name="title" defaultValue={title ?? ''} className={ui.input} />
      </label>
      {state.error && <p className={ui.error}>{state.error}</p>}
      {state.saved && !state.error && <p className={ui.note}>{tForm('saved')}</p>}
      <button type="submit" className={`self-start ${ui.primaryButton}`} disabled={saving}>
        {tForm('save')}
      </button>
    </form>
  );
}
