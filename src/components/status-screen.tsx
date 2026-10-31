import Image from 'next/image';
import type { ReactNode } from 'react';
import marmot from '@/images/marmot.png';

/**
 * 見つからない・うまく表示できないときの画面。上の帯と下のリンクは残し、真ん中に Liveeen のキャラクターと文を出す
 * （トップの「いま配信している人はいません」と同じ並び。onigiri の not-found と同じ考え）
 */
export function StatusScreen({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {/* Liveeen のキャラクター（design/README.md） */}
      <Image src={marmot} alt="" className="h-44 w-auto" />
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-muted">{message}</p>
      <div className="flex gap-2">{children}</div>
    </main>
  );
}
