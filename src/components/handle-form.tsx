'use client';

import { useActionState } from 'react';
import { type HandleState, setHandleAction } from '@/app/settings/actions';
import { HANDLE_MAX, HANDLE_MIN } from '@/lib/handle';
import { ui } from '@/lib/ui';

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
        <span className={ui.subheading}>ハンドル</span>
        <span className={ui.note}>
          配信の住所（/@ハンドル）になります。英小文字・数字・_ の{HANDLE_MIN}〜{HANDLE_MAX}文字
          {handle && '。変えると前の住所は使えなくなります'}
        </span>
        <input
          name="handle"
          defaultValue={handle ?? ''}
          required
          className={ui.input}
          autoCapitalize="none"
          autoComplete="username"
          spellCheck={false}
        />
      </label>
      {state.error && <p className={ui.error}>{state.error}</p>}
      {state.saved && !state.error && <p className={ui.note}>保存しました</p>}
      <button type="submit" className={`self-start ${ui.primaryButton}`} disabled={saving}>
        保存
      </button>
    </form>
  );
}
