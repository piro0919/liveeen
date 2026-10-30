'use client';

import { useState, useTransition } from 'react';
import { reportAction } from '@/app/[channelId]/actions';
import { signIn } from '@/lib/auth-client';

type Props = {
  channelId: string;
  /** いまの配信をもう通報したか。ログインしていなければ null */
  reported: boolean | null;
};

/** 配信の通報。押すと確かめてから送る。ログインしていなければ、押すとログインへ */
export function ReportButton({ channelId, reported }: Props) {
  const [sending, startTransition] = useTransition();
  const [done, setDone] = useState(reported === true);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded border px-4 py-2"
        disabled={sending || done}
        onClick={() => {
          if (reported === null) {
            void signIn();
            return;
          }
          if (!window.confirm('この配信を通報しますか')) return;
          startTransition(async () => {
            const result = await reportAction(channelId);
            if (result === 'reported') setDone(true);
            else setMessage('配信していないので通報できません');
          });
        }}
      >
        {done ? '通報しました' : '通報する'}
      </button>
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
