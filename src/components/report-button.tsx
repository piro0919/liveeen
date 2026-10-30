'use client';

import { useState, useTransition } from 'react';
import { reportAction } from '@/app/[channelId]/actions';
import { signIn } from '@/lib/auth-client';
import { REPORT_REASONS } from '@/lib/report-reason';

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
  const [sending, startTransition] = useTransition();
  const [done, setDone] = useState(reported === true);
  const [choosing, setChoosing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function send(form: FormData) {
    const reason = String(form.get('reason') ?? '');
    startTransition(async () => {
      const result = await reportAction(channelId, reason);
      setChoosing(false);
      if (result === 'reported') setDone(true);
      else setMessage('配信していないので通報できません');
    });
  }

  if (choosing) {
    return (
      <form action={send} className="flex flex-col gap-2 rounded border p-2">
        <fieldset className="flex flex-col gap-1" disabled={sending}>
          <legend className="font-bold">通報の理由</legend>
          {REPORT_REASONS.map((reason) => (
            <label key={reason.value} className="flex items-center gap-2">
              <input type="radio" name="reason" value={reason.value} required />
              {reason.label}
            </label>
          ))}
        </fieldset>
        <div className="flex gap-2">
          <button type="submit" className="rounded border px-4 py-2" disabled={sending}>
            通報する
          </button>
          <button
            type="button"
            className="rounded border px-4 py-2"
            disabled={sending}
            onClick={() => setChoosing(false)}
          >
            やめる
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded border px-4 py-2"
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
        {done ? '通報しました' : '通報する'}
      </button>
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
