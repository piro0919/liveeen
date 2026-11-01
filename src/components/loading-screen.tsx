import { useTranslations } from 'next-intl';
import { ui } from '@/lib/ui';

/** 読み込み中の灰色の札の数 */
const CARD_COUNT = 8;
const ROW_COUNT = 5;

/** 読み込み中と読み上げに伝える */
function Status() {
  const t = useTranslations('loading');
  return (
    <p role="status" className="sr-only">
      {t('status')}
    </p>
  );
}

/** トップの読み込み中。札の並びと同じ形の灰色を出す（手本は YouTube のトップ） */
export function CardsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Status />
      <div className={`h-7 w-32 ${ui.skeleton}`} />
      <ul className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: CARD_COUNT }, (_, index) => (
          <li key={index} className="flex flex-col gap-3">
            <div className={`aspect-video ${ui.skeleton}`} />
            <div className="flex gap-3">
              <div className={`size-9 shrink-0 ${ui.skeletonRound}`} />
              <div className="flex flex-1 flex-col gap-2">
                <div className={`h-4 w-3/4 ${ui.skeleton}`} />
                <div className={`h-3 w-1/2 ${ui.skeleton}`} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** 一覧や設定の読み込み中 */
export function RowsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <Status />
      <div className={`h-7 w-32 ${ui.skeleton}`} />
      {Array.from({ length: ROW_COUNT }, (_, index) => (
        <div key={index} className={`h-16 ${ui.skeleton}`} />
      ))}
    </main>
  );
}
