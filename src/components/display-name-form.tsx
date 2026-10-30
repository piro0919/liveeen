'use client';

import { useActionState } from 'react';
import { setDisplayNameAction, type DisplayNameState } from '@/app/settings/actions';
import { DISPLAY_NAME_MAX } from '@/lib/display-name';

const INITIAL: DisplayNameState = { error: null, saved: false };

/**
 * 人前に出す名前を付ける欄。配信の一覧とコメントに出る。
 * まだ付けていない人には、配信やコメントの前にこの欄を出す
 */
export function DisplayNameForm({ name }: { name: string | null }) {
  const [state, save, saving] = useActionState(setDisplayNameAction, INITIAL);
  return (
    <form action={save} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="font-bold">名前</span>
        <span className="text-sm text-gray-500">
          配信の一覧とコメントに出ます。{DISPLAY_NAME_MAX}文字まで
        </span>
        <input
          name="name"
          defaultValue={name ?? ''}
          required
          className="rounded border px-2 py-1"
          autoComplete="nickname"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && !state.error && <p className="text-sm">保存しました</p>}
      <button type="submit" className="self-start rounded border px-4 py-2" disabled={saving}>
        保存
      </button>
    </form>
  );
}
