'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { reportAction } from '@/app/[channelId]/actions';
import { signIn } from '@/lib/auth-client';
import { REPORT_REASONS } from '@/lib/report-reason';
import { safely } from '@/lib/safe-action';
import { ui } from '@/lib/ui';

type Props = {
  channelId: string;
  /** いまの配信をもう通報したか。ログインしていなければ null */
  reported: boolean | null;
};

/**
 * 配信の通報。押すと理由を選ぶ欄が開き、選んで送る（選んで送ることが確かめの代わり）。
 * ログインしていなければ、押すとログインへ
 */
export function ReportButton({ channelId, reported }: Props) {
  const t = useTranslations('report');
  const tReason = useTranslations('reportReasons');
  const [sending, startTransition] = useTransition();
  const [done, setDone] = useState(reported === true);
  const [choosing, setChoosing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function send(form: FormData) {
    const reason = String(form.get('reason') ?? '');
    startTransition(async () => {
      const result = await safely(() => reportAction(channelId, reason));
      // 届かなければ、選んだ理由のまま開いておき、もう一度送れるようにする
      if (result === undefined) return;
      setChoosing(false);
      if (result === 'reported') setDone(true);
      else setMessage(t('offline'));
    });
  }

  if (choosing) {
    return (
      <form action={send} className={`flex basis-full flex-col gap-3 p-4 ${ui.panel}`}>
        <fieldset className="flex flex-col gap-1" disabled={sending}>
          <legend className="mb-2 font-bold">{t('reasonLegend')}</legend>
          {REPORT_REASONS.map((reason) => (
            <label key={reason} className="flex items-center gap-2">
              <input type="radio" className={ui.check} name="reason" value={reason} required />
              {tReason(reason)}
            </label>
          ))}
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="submit" className={ui.primaryButton} disabled={sending}>
            {t('send')}
          </button>
          <button
            type="button"
            className={ui.tonalButton}
            disabled={sending}
            onClick={() => setChoosing(false)}
          >
            {t('cancel')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        className={ui.tonalButton}
        disabled={done}
        onClick={() => {
          if (reported === null) {
            void signIn();
            return;
          }
          setMessage(null);
          setChoosing(true);
        }}
      >
        {done ? t('done') : t('button')}
      </button>
      {message && <p className={ui.error}>{message}</p>}
    </div>
  );
}
