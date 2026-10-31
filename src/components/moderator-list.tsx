import { useTranslations } from 'next-intl';
import { removeModeratorAction } from '@/app/broadcast/actions';
import type { Moderator } from '@/lib/moderation';
import { ConfirmButton } from './confirm-button';
import { ui } from '@/lib/ui';

/**
 * 配信者が選んだモデレーター（/broadcast）。名前を出し、外せる。
 * 選ぶのは、自分のチャンネルの見る画面か OBS の画面で、コメントの横の「モデレーターにする」から
 */
export function ModeratorList({ moderators }: { moderators: Moderator[] }) {
  const t = useTranslations('moderatorList');
  return (
    <section className={ui.card}>
      <h2 className={ui.subheading}>{t('heading')}</h2>
      <p className={ui.note}>{t('description')}</p>
      {moderators.length === 0 ? (
        <p>{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {moderators.map((moderator) => (
            <li key={moderator.userId} className="flex flex-wrap items-center gap-2">
              <span>{moderator.displayName ?? t('noName')}</span>
              <ConfirmButton
                label={t('remove')}
                confirm={
                  moderator.displayName
                    ? t('confirmRemove', { name: moderator.displayName })
                    : t('confirmRemoveNoName')
                }
                action={removeModeratorAction.bind(null, moderator.userId)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
