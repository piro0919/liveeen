'use client';

import { type RefObject, useActionState, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { setStreamTitleAction, type StreamTitleState } from '@/app/broadcast/actions';
import { STREAM_TITLE_MAX } from '@/lib/stream-title';
import { guarded } from '@/lib/safe-action';
import { ui } from '@/lib/ui';

const INITIAL: StreamTitleState = { error: null, saved: false };

type Props = {
  title: string | null;
  /** 配信を始めるとき、保存を押していない入力も読むため（src/components/broadcast-setup.tsx） */
  inputRef?: RefObject<HTMLInputElement | null>;
};

/** 配信のタイトルを付ける欄（/broadcast、配信中の画面、/broadcast/obs）。トップの一覧と見る画面に出る */
export function StreamTitleForm({ title, inputRef }: Props) {
  const t = useTranslations('streamTitleForm');
  const tForm = useTranslations('form');
  const [state, save, saving] = useActionState(guarded(setStreamTitleAction), INITIAL);
  const id = useId();
  // 手元で値を持つ。持たないと、断られたときも React が欄を前のタイトルへ戻し、入れた文が消える
  const [value, setValue] = useState(title ?? '');
  // 配信中の画面で変えたら、裏の /broadcast の欄も合わせる。古い入力のまま次の配信で上書きしないため
  const [savedTitle, setSavedTitle] = useState(title);
  if (savedTitle !== title) {
    setSavedTitle(title);
    setValue(title ?? '');
  }
  return (
    <form action={save} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1" htmlFor={id}>
        <span className={ui.subheading}>{t('label')}</span>
        <span className={ui.note}>{t('description', { max: STREAM_TITLE_MAX })}</span>
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={id}
          name="title"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={`flex-1 ${ui.input}`}
        />
        <button type="submit" className={ui.primaryButton} disabled={saving}>
          {tForm('save')}
        </button>
      </div>
      {state.error && <p className={ui.error}>{state.error}</p>}
      {state.saved && !state.error && <p className={ui.note}>{tForm('saved')}</p>}
    </form>
  );
}
