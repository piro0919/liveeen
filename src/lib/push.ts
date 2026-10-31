import 'server-only';
import webpush from 'web-push';
import { db } from './db';
import {
  isPushServiceEndpoint,
  type LiveStarted,
  liveStartedMessage,
  subscriptionGone,
} from './push-message';
import { env } from '@/env';

/** 届かなかったときに送り口が持っておく長さ。配信の始まりの知らせは、遅れて届いても意味が薄い */
const TTL_SECONDS = 600;

/** 1人が持てる送り口の数。ブラウザごとに1つなので、使う端末の数より十分多くする */
const PUSH_SUBSCRIPTIONS_PER_USER = 10;

/** 1つの送り口を待つ長さ（ミリ秒）。web-push は既定では待ち続け、配信が始まったときの送信がそこで止まる */
const SEND_TIMEOUT_MS = 10_000;

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
     set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
       created_at = now()`,
    [subscription.endpoint, userId, subscription.p256dh, subscription.auth],
  );
  // 1人の送り口は新しいほうから決まった数まで。送り口は好きな値を何度でも送ってこられるので、
  // 積まれると配信が始まったときの送信がそれだけ重くなる
  await db().query(
    `delete from push_subscription
     where user_id = $1 and endpoint not in (
       select endpoint from push_subscription where user_id = $1
       order by created_at desc limit $2
     )`,
    [userId, PUSH_SUBSCRIPTIONS_PER_USER],
  );
}

/**
 * ブラウザが取り替えた送り口を、前の送り口の行に書き換える（public/sw.js の pushsubscriptionchange）。
 * 前の行が無ければ何もしない。新しい送り口が別の行にもうあれば、前の行を消す
 */
export async function renewPushSubscription(
  oldEndpoint: string,
  subscription: PushSubscriptionInput,
): Promise<void> {
  await db().query(
    `with old as (delete from push_subscription where endpoint = $1 returning user_id)
     insert into push_subscription (endpoint, user_id, p256dh, auth)
     select $2, user_id, $3, $4 from old
     on conflict (endpoint) do update
     set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [oldEndpoint, subscription.endpoint, subscription.p256dh, subscription.auth],
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
export async function sendLivePushes(started: LiveStarted): Promise<void> {
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return;
  const { rows: subscriptions } = await db().query<PushSubscriptionInput>(
    `select push_subscription.endpoint, push_subscription.p256dh, push_subscription.auth
     from push_subscription join follow on follow.user_id = push_subscription.user_id
     where follow.channel_id = $1`,
    [started.channelId],
  );
  const payload = JSON.stringify(liveStartedMessage(started));
  const vapidDetails = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  // 登録のときにも見ているが、行は前の決まりのときに入ったものもある。送らずに消す
  const foreign = subscriptions.filter(({ endpoint }) => !isPushServiceEndpoint(endpoint));
  if (foreign.length > 0) {
    await db().query('delete from push_subscription where endpoint = any($1::text[])', [
      foreign.map(({ endpoint }) => endpoint),
    ]);
  }
  await Promise.all(
    subscriptions
      .filter(({ endpoint }) => isPushServiceEndpoint(endpoint))
      .map(async ({ endpoint, p256dh, auth }) => {
        try {
          await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload, {
            vapidDetails,
            TTL: TTL_SECONDS,
            timeout: SEND_TIMEOUT_MS,
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
