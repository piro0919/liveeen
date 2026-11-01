'use client';

import { type SubmitEvent, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { reportAction } from '@/app/[channelId]/actions';
import { signIn } from '@/lib/auth-client';
import { REPORT_REASONS } from '@/lib/report-reason';
import { safely } from '@/lib/safe-action';
import { ui } from '@/lib/ui';
import { ActionSheet } from './action-sheet';
import { FlagIcon, MoreIcon } from './nav-icons';

type Props = {
  channelId: string;
  /** いまの配信をもう通報したか。ログインしていなければ null */
  reported: boolean | null;
};

/**
 * 配信の「その他」。手本は YouTube：「…」を押すと下から一覧が開き、その中に報告がある。
 * 通報を選ぶと同じシートで理由を選んで送る（選んで送ることが確かめの代わり）。ログインしていなければ、押すとログインへ
 */
export function ReportButton({ channelId, reported }: Props) {
  const t = useTranslations('report');
  const tReason = useTranslations('reportReasons');
  const tToast = useTranslations('toast');
  const [sending, startTransition] = useTransition();
  const [done, setDone] = useState(reported === true);
  const [view, setView] = useState<'closed' | 'menu' | 'reasons'>('closed');
  const [failed, setFailed] = useState(false);

  // action ではなく onSubmit で送る。action は終わると欄を空に戻すので、届かなかったときに選んだ理由が消える
  function send(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '');
    setFailed(false);
    startTransition(async () => {
      const result = await safely(() => reportAction(channelId, reason));
      // 届かなければ、選んだ理由のまま開いておき、もう一度送れるようにする。
      // 一瞬の知らせはシートの背景の下に隠れるので、シートの中に書く
      if (result === undefined) {
        setFailed(true);
        return;
      }
      setView('closed');
      if (result === 'reported') setDone(true);
      else toast(t('offline'));
    });
  }

  return (
    <>
      <button
        type="button"
        className={ui.iconButton}
        aria-label={t('more')}
        aria-haspopup="dialog"
        onClick={() => setView('menu')}
      >
        <MoreIcon />
      </button>
      {view !== 'closed' && (
        <ActionSheet label={t('more')} onClose={() => setView('closed')}>
          {view === 'menu' ? (
            <button
              type="button"
              className={ui.sheetItem}
              disabled={done}
              onClick={() => {
                if (reported === null) {
                  void signIn();
                  return;
                }
                setView('reasons');
              }}
            >
              <FlagIcon />
              {done ? t('done') : t('button')}
            </button>
          ) : (
            <form onSubmit={send} className="flex flex-col gap-3 p-2">
              <fieldset className="flex flex-col gap-1" disabled={sending}>
                <legend className="mb-2 font-bold">{t('reasonLegend')}</legend>
                {REPORT_REASONS.map((reason) => (
                  <label key={reason} className="flex min-h-10 items-center gap-2">
                    <input
                      type="radio"
                      className={ui.check}
                      name="reason"
                      value={reason}
                      required
                    />
                    {tReason(reason)}
                  </label>
                ))}
              </fieldset>
              {failed && <p className={ui.error}>{tToast('actionFailed')}</p>}
              <div className="flex justify-end gap-2">
                <button type="submit" className={ui.primaryButton} disabled={sending}>
                  {t('send')}
                </button>
                <button
                  type="button"
                  className={ui.tonalButton}
                  disabled={sending}
                  onClick={() => setView('closed')}
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          )}
        </ActionSheet>
      )}
    </>
  );
}
