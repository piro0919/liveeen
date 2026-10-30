'use client';

import { useActionState } from 'react';
import { type HandleState, setHandleAction } from '@/app/settings/actions';
import { HANDLE_MAX, HANDLE_MIN } from '@/lib/handle';

const INITIAL: HandleState = { error: null, saved: false };

/**
 * 配信者の住所（/@ハンドル）を選ぶ欄。配信の画面で名前の次に聞き、設定で変えられる。
 * 変えると前の住所は切れる
 */
export function HandleForm({ handle }: { handle: string | null }) {
  const [state, save, saving] = useActionState(setHandleAction, INITIAL);
  return (
    <form action={save} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="font-bold">ハンドル</span>
        <span className="text-sm text-gray-500">
          配信の住所（/@ハンドル）になります。英小文字・数字・_ の{HANDLE_MIN}〜{HANDLE_MAX}文字
          {handle && '。変えると前の住所は使えなくなります'}
        </span>
        <input
          name="handle"
          defaultValue={handle ?? ''}
          required
          className="rounded border px-2 py-1"
          autoCapitalize="none"
          autoComplete="username"
          spellCheck={false}
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
