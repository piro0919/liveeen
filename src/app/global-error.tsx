'use client';

import Link from 'next/link';
import { ui } from '@/lib/ui';
import { GLOBAL_ERROR_TEXTS as texts } from './global-error-messages';
import './globals.css';

/**
 * 外枠（ルートの layout）ごと落ちたとき。上の帯も出せないので、html から自前で描く（onigiri と同じ置き方）。
 * これが無いと Next.js の英語の素の画面が出る。文言は仮（src/app/global-error-messages.ts）
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ja">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-4 text-center text-foreground">
        <h1 className={ui.heading}>{texts.title}</h1>
        <p className={ui.note}>{texts.message}</p>
        <div className="flex gap-2">
          <button type="button" onClick={reset} className={ui.primaryButton}>
            {texts.retry}
          </button>
          <Link href="/" className={ui.tonalButton}>
            {texts.home}
          </Link>
        </div>
      </body>
    </html>
  );
}
