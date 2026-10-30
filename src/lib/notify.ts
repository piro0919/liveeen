import 'server-only';
import { db } from './db';
import { sendLiveEmails } from './email';
import { sendLivePushes } from './push';
import type { LiveStarted } from './push-message';

/**
 * 前の知らせからこれだけ経たずに始まった配信は、知らせ直さない。
 * OBS は切れるとすぐにつなぎ直すので、そのたびにフォローした人へ知らせが飛ばないようにする。長さは Claude が決めた
 */
const RENOTIFY_AFTER_MINUTES = 10;

/**
 * チャンネルが配信を始めたことを、フォローした人へ知らせる（ブラウザ通知とメール）。
 * 前の知らせから RENOTIFY_AFTER_MINUTES 経っていなければ知らせない
 */
export async function notifyLiveStarted(channelId: string): Promise<void> {
  // 知らせた時刻を先に進める。2つの問い合わせが同時に来ても、知らせるのは片方だけ
  const { rows: claimed } = await db().query<{
    displayName: string | null;
    handle: string | null;
  }>(
    `update channel set notified_at = now()
     where id = $1 and banned_at is null
       and (notified_at is null or notified_at < now() - make_interval(mins => $2))
     returning (select display_name from profile where profile.user_id = channel.user_id) as "displayName",
       (select handle from profile where profile.user_id = channel.user_id) as handle`,
    [channelId, RENOTIFY_AFTER_MINUTES],
  );
  if (claimed.length === 0) return;
  const started: LiveStarted = { channelId, ...claimed[0] };
  // 片方が失敗しても、もう片方は送る
  const results = await Promise.allSettled([sendLivePushes(started), sendLiveEmails(started)]);
  for (const result of results) {
    if (result.status === 'rejected')
      console.error('配信の始まりを知らせられませんでした', result.reason);
  }
}
