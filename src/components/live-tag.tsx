import { getTranslations } from 'next-intl/server';
import { ui } from '@/lib/ui';

/** 絵の左上に重ねるライブの札。点は点滅する（動きを減らす設定の端末では止める） */
export async function LiveTag() {
  const t = await getTranslations('home');
  return (
    <span className={`absolute top-2 left-2 ${ui.liveTag}`}>
      <span
        aria-hidden
        className="size-1.5 animate-pulse rounded-xs bg-current motion-reduce:animate-none"
      />
      {t('live')}
    </span>
  );
}
