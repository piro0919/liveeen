'use client';

import { deletePushSubscriptionAction } from '@/app/settings/actions';
import { signOut as authSignOut } from './auth-client';
import { currentSubscription } from './push-browser';

/** 通知の片付けを待つ上限。電波が悪くてもログアウトを待たせない */
const PUSH_CLEANUP_TIMEOUT_MS = 3000;

function limited(work: Promise<unknown>): Promise<unknown> {
  return Promise.race([
    work.catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, PUSH_CLEANUP_TIMEOUT_MS)),
  ]);
}

/** このブラウザの通知の宛先を外す。端末の中で済む購読の解除を先にし、通知はそこで止まる。外した宛先を返す */
async function unsubscribeBrowser(): Promise<string | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  return endpoint;
}

/**
 * ログアウト（jumps-lab と同じ）。共用の端末で、前の人がフォローしている配信者の知らせが次の人に届かないよう、
 * 先にこの端末の通知を外す。サーバーの行は、消せなくても次に送ったとき通知の仕組みが無効と返して消える。
 * 外せなくても、時間がかかってもログアウトは止めない。失敗は投げずに返す
 */
export async function signOut(): Promise<{ error: unknown }> {
  await limited(
    unsubscribeBrowser().then((endpoint) =>
      endpoint ? deletePushSubscriptionAction(endpoint).catch(() => undefined) : undefined,
    ),
  );
  const { error } = await authSignOut().catch(() => ({ error: true }));
  return { error };
}

/** アカウントを消したあと、このブラウザの購読を外す。サーバーの行はアカウントと一緒に消えている */
export async function dropBrowserPush(): Promise<void> {
  await limited(unsubscribeBrowser());
}
