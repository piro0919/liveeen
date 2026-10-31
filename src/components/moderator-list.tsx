import { removeModeratorAction } from '@/app/broadcast/actions';
import type { Moderator } from '@/lib/moderation';
import { ConfirmButton } from './confirm-button';
import { ui } from '@/lib/ui';

/**
 * 配信者が選んだモデレーター（/broadcast）。名前を出し、外せる。
 * 選ぶのは、自分のチャンネルの見る画面か OBS の画面で、コメントの横の「モデレーターにする」から
 */
export function ModeratorList({ moderators }: { moderators: Moderator[] }) {
  return (
    <section className={ui.card}>
      <h2 className={ui.subheading}>モデレーター</h2>
      <p className={ui.note}>
        モデレーターはコメントした人をブロックでき、低速モード・禁止語・コメントできる人の決まりにかかりません。コメントの横の「モデレーターにする」から選べます
      </p>
      {moderators.length === 0 ? (
        <p>モデレーターはいません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {moderators.map((moderator) => (
            <li key={moderator.userId} className="flex flex-wrap items-center gap-2">
              <span>{moderator.displayName ?? '（名前なし）'}</span>
              <ConfirmButton
                label="外す"
                confirm={`${moderator.displayName ?? 'この人'}さんをモデレーターから外しますか？`}
                action={removeModeratorAction.bind(null, moderator.userId)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
