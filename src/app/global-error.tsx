'use client';

import Link from 'next/link';
import { ui } from '@/lib/ui';
import './globals.css';

/**
 * 外枠（ルートの layout）ごと落ちたとき。上の帯も出せないので、html から自前で描く（onigiri と同じ置き方）。
 * これが無いと Next.js の英語の素の画面が出る。文言は仮
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ja">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-4 text-center text-foreground">
        <h1 className={ui.heading}>うまく表示できませんでした</h1>
        <p className={ui.note}>少しおいて、もう一度お試しください</p>
        <div className="flex gap-2">
          <button type="button" onClick={reset} className={ui.primaryButton}>
            もう一度
          </button>
          <Link href="/" className={ui.tonalButton}>
            トップへ
          </Link>
        </div>
      </body>
    </html>
  );
}
