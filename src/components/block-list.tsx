import { useTranslations } from 'next-intl';
import { unblockCommenterAction } from '@/app/broadcast/actions';
import type { CommentBlock } from '@/lib/blocks';
import { ConfirmButton } from './confirm-button';
import { ui } from '@/lib/ui';

/** 日本の時刻で出す（初版は日本向け。CLAUDE.md） */
const timeFormat = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tokyo',
});

type Props = { blocks: CommentBlock[] };

/** 配信者がコメントでブロックした人（/broadcast）。名前と止めた日時を出し、戻せる */
export function BlockList({ blocks }: Props) {
  const t = useTranslations('blockList');
  return (
    <section className={ui.card}>
      <h2 className={ui.subheading}>{t('heading')}</h2>
      {blocks.length === 0 ? (
        <p>{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {blocks.map((block) => (
            <li key={block.id} className="flex flex-wrap items-center gap-2">
              <span>{block.displayName}</span>
              <span className={ui.note}>{timeFormat.format(block.createdAt)}</span>
              <ConfirmButton
                label={t('unblock')}
                confirm={t('confirmUnblock', { name: block.displayName })}
                action={unblockCommenterAction.bind(null, block.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
