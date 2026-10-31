'use client';

import { useActionState } from 'react';
import { type CommentRulesState, setCommentRulesAction } from '@/app/broadcast/actions';
import {
  BLOCKED_WORD_LENGTH_MAX,
  BLOCKED_WORDS_MAX,
  type CommentSettings,
  FOLLOWERS_ONLY_CHOICES,
  SLOW_MODE_CHOICES,
} from '@/lib/comment-settings';
import { ui } from '@/lib/ui';

const INITIAL: CommentRulesState = { error: null, saved: false };

/** 選び肢の言葉（文言は仮） */
function slowLabel(seconds: number): string {
  return seconds === 0 ? 'なし' : `${seconds}秒`;
}

function followersLabel(minutes: number | null): string {
  if (minutes === null) return '誰でも';
  return minutes === 0 ? 'フォローしている人だけ' : `フォローして${minutes}分以上の人だけ`;
}

/**
 * コメントの決まり（/broadcast）。低速モード・コメントできる人・禁止語。
 * 保存すると、見ている人にもその場で効く（中継へ送る。src/app/broadcast/actions.ts）。
 * 配信者とモデレーターはどれにもかからない
 */
export function CommentRulesForm({ settings }: { settings: CommentSettings }) {
  const [state, save, saving] = useActionState(setCommentRulesAction, INITIAL);
  return (
    <form action={save} className="flex flex-col gap-4">
      <h2 className={ui.subheading}>コメントの管理</h2>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1">低速モード</legend>
        <p className={`mb-1 ${ui.note}`}>1人が続けて書けるまでの間をあけます</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {SLOW_MODE_CHOICES.map((seconds) => (
            <label key={seconds} className="flex items-center gap-2">
              <input
                type="radio"
                className={ui.check}
                name="slow"
                value={seconds}
                defaultChecked={settings.slowSeconds === seconds}
              />
              {slowLabel(seconds)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1">コメントできる人</legend>
        {FOLLOWERS_ONLY_CHOICES.map((minutes) => (
          <label key={String(minutes)} className="flex items-center gap-2">
            <input
              type="radio"
              className={ui.check}
              name="followers"
              value={minutes ?? ''}
              defaultChecked={settings.followersOnlyMinutes === minutes}
            />
            {followersLabel(minutes)}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        <span>禁止語</span>
        <span className={ui.note}>
          1行に1つ。含むコメントは書いた人にだけ見え、ほかの人には届きません。{BLOCKED_WORDS_MAX}
          個まで、1つ{BLOCKED_WORD_LENGTH_MAX}文字まで
        </span>
        <textarea
          name="words"
          defaultValue={settings.blockedWords.join('\n')}
          className={ui.textarea}
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
