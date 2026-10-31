'use client';

import { useActionState } from 'react';
import { setStreamTitleAction, type StreamTitleState } from '@/app/broadcast/actions';
import { STREAM_TITLE_MAX } from '@/lib/stream-title';
import { ui } from '@/lib/ui';

const INITIAL: StreamTitleState = { error: null, saved: false };

/** 配信のタイトルを付ける欄（/broadcast と /broadcast/obs）。トップの一覧と見る画面に出る */
export function StreamTitleForm({ title }: { title: string | null }) {
  const [state, save, saving] = useActionState(setStreamTitleAction, INITIAL);
  return (
    <form action={save} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className={ui.subheading}>タイトル</span>
        <span className={ui.note}>配信の一覧と見る画面に出ます。{STREAM_TITLE_MAX}文字まで</span>
        <input name="title" defaultValue={title ?? ''} className={ui.input} />
      </label>
      {state.error && <p className={ui.error}>{state.error}</p>}
      {state.saved && !state.error && <p className={ui.note}>保存しました</p>}
      <button type="submit" className={`self-start ${ui.primaryButton}`} disabled={saving}>
        保存
      </button>
    </form>
  );
}
