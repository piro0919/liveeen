'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  deletePushSubscriptionAction,
  hasPushSubscriptionAction,
  savePushSubscriptionAction,
} from '@/app/settings/actions';
import { usePwa } from 'use-pwa';
import { safely } from '@/lib/safe-action';
import { ui } from '@/lib/ui';

/** 受け取る service worker（public/sw.js） */
const SERVICE_WORKER_URL = '/sw.js';

/** 切り替えの状態。読み込み中・このブラウザで使えない・止められている・入／切 */
type PushState = 'loading' | 'unsupported' | 'denied' | 'on' | 'off';

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** base64 の文字数は、この数の倍数になるよう = で埋める */
const BASE64_BLOCK = 4;

/** VAPID の公開の鍵（base64url）を、pushManager.subscribe が受け取る形にする */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / BASE64_BLOCK) * BASE64_BLOCK, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** このブラウザの送り口。まだ作っていなければ null */
async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function subscribe(publicKey: string): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('送り口を作れませんでした');
  const saved = await safely(() =>
    savePushSubscriptionAction({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
  );
  // 届かなければ、覚えてもらえていない送り口を残さない
  if (!saved) {
    await subscription.unsubscribe();
    return 'off';
  }
  return 'on';
}

async function unsubscribe(): Promise<PushState> {
  const subscription = await currentSubscription();
  if (subscription) {
    // 届かなければ、サーバーに残ったまま切ったことにしない
    if (!(await safely(() => deletePushSubscriptionAction(subscription.endpoint)))) return 'on';
    await subscription.unsubscribe();
  }
  return 'off';
}

/**
 * フォローした人が配信を始めたら、このブラウザに通知を出すか。ブラウザごとに入れる。
 * 入っているかは、このブラウザの送り口がいまの人のものとして覚えてあるかで見る
 * （同じブラウザで別の人がログインしていれば切に見える）
 */
export function BrowserPushChoice({ publicKey }: { publicKey: string }) {
  const t = useTranslations('browserPush');
  const [state, setState] = useState<PushState>('loading');
  const [saving, startTransition] = useTransition();
  // iOS でまだホーム画面に追加していない。ホーム画面から開いてもまだ使えない端末には、ふつうの文を出す
  const { needsManualInstall } = usePwa();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let next: PushState;
      if (!supported()) next = 'unsupported';
      else if (Notification.permission === 'denied') next = 'denied';
      else {
        const subscription = await currentSubscription();
        next =
          subscription && (await safely(() => hasPushSubscriptionAction(subscription.endpoint)))
            ? 'on'
            : 'off';
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // iPhone の Safari は、ホーム画面に追加して開いたときだけ Web Push を使える
  if (state === 'unsupported')
    return <p>{t(needsManualInstall ? 'unsupportedIos' : 'unsupported')}</p>;
  if (state === 'denied') {
    return <p>{t('denied')}</p>;
  }
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        className={ui.check}
        checked={state === 'on'}
        disabled={state === 'loading' || saving}
        onChange={(event) => {
          const on = event.target.checked;
          startTransition(async () => {
            setState(await (on ? subscribe(publicKey) : unsubscribe()));
          });
        }}
      />
      {t('label')}
    </label>
  );
}
