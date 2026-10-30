import 'server-only';
import webpush from 'web-push';
import { db } from './db';
import { liveStartedMessage, subscriptionGone } from './push-message';
import { env } from '@/env';

/** 届かなかったときに送り口が持っておく長さ。配信の始まりの知らせは、遅れて届いても意味が薄い */
const TTL_SECONDS = 600;

/** ブラウザ（public/sw.js の pushManager.subscribe）から受け取る送り口 */
export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string };

/** このブラウザの送り口を、その人のものとして覚える */
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionInput,
): Promise<void> {
  await db().query(
    `insert into push_subscription (endpoint, user_id, p256dh, auth) values ($1, $2, $3, $4)
     on conflict (endpoint) do update
     set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [subscription.endpoint, userId, subscription.p256dh, subscription.auth],
  );
}

/** このブラウザの送り口を忘れる。その人のものでなければ何もしない */
export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  await db().query('delete from push_subscription where endpoint = $1 and user_id = $2', [
    endpoint,
    userId,
  ]);
}

/** その送り口が、その人のものとして覚えてあるか */
export async function hasPushSubscription(userId: string, endpoint: string): Promise<boolean> {
  const { rowCount } = await db().query(
    'select 1 from push_subscription where endpoint = $1 and user_id = $2',
    [endpoint, userId],
  );
  return rowCount === 1;
}

/**
 * チャンネルが配信を始めたことを、フォローしてブラウザ通知を入れた人へ送る。
 * VAPID の鍵が無い環境では送らない
 */
export async function sendLivePushes(channelId: string, displayName: string | null): Promise<void> {
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return;
  const { rows: subscriptions } = await db().query<PushSubscriptionInput>(
    `select push_subscription.endpoint, push_subscription.p256dh, push_subscription.auth
     from push_subscription join follow on follow.user_id = push_subscription.user_id
     where follow.channel_id = $1`,
    [channelId],
  );
  const payload = JSON.stringify(liveStartedMessage(channelId, displayName));
  const vapidDetails = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  await Promise.all(
    subscriptions.map(async ({ endpoint, p256dh, auth }) => {
      try {
        await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload, {
          vapidDetails,
          TTL: TTL_SECONDS,
        });
      } catch (error) {
        if (error instanceof webpush.WebPushError && subscriptionGone(error.statusCode)) {
          await db().query('delete from push_subscription where endpoint = $1', [endpoint]);
          return;
        }
        console.error('ブラウザ通知を送れませんでした', error);
      }
    }),
  );
}
