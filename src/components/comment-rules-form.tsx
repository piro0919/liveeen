'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { type CommentRulesState, setCommentRulesAction } from '@/app/broadcast/actions';
import {
  BLOCKED_WORD_LENGTH_MAX,
  BLOCKED_WORDS_MAX,
  type CommentSettings,
  FOLLOWERS_ONLY_CHOICES,
  SLOW_MODE_CHOICES,
} from '@/lib/comment-settings';
import { guarded } from '@/lib/safe-action';
import { ui } from '@/lib/ui';

const INITIAL: CommentRulesState = { error: null, saved: false };

/**
 * コメントの決まり（/broadcast）。低速モード・コメントできる人・禁止語。
 * 保存すると、見ている人にもその場で効く（中継へ送る。src/app/broadcast/actions.ts）。
 * 配信者とモデレーターはどれにもかからない
 */
export function CommentRulesForm({ settings }: { settings: CommentSettings }) {
  const t = useTranslations('commentRules');
  const tForm = useTranslations('form');
  const [state, save, saving] = useActionState(guarded(setCommentRulesAction), INITIAL);
  return (
    <form action={save} className="flex flex-col gap-4">
      <h2 className={ui.subheading}>{t('heading')}</h2>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1">{t('slowMode')}</legend>
        <p className={`mb-1 ${ui.note}`}>{t('slowModeDescription')}</p>
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
              {t('slowSeconds', { seconds })}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1">{t('who')}</legend>
        {FOLLOWERS_ONLY_CHOICES.map((minutes) => (
          <label key={String(minutes)} className="flex items-center gap-2">
            <input
              type="radio"
              className={ui.check}
              name="followers"
              value={minutes ?? ''}
              defaultChecked={settings.followersOnlyMinutes === minutes}
            />
            {minutes === null ? t('anyone') : t('followers', { minutes })}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        <span>{t('blockedWords')}</span>
        <span className={ui.note}>
          {t('blockedWordsDescription', {
            max: BLOCKED_WORDS_MAX,
            length: BLOCKED_WORD_LENGTH_MAX,
          })}
        </span>
        <textarea
          name="words"
          defaultValue={settings.blockedWords.join('\n')}
          className={ui.textarea}
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
