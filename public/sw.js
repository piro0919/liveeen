// ブラウザ通知（Web Push）を受け取る service worker。設定（/settings）で通知を入れたときに登録する。
// 送ってくる中身の形は src/lib/push-message.ts

/**
 * 届いた中身を読む。読めなくても何か出す。出さないと、ブラウザが「裏で更新しました」の類を代わりに出し、
 * 続くと通知の権限を止めるブラウザがある
 */
function readMessage(event) {
  try {
    const message = event.data?.json();
    // url が無いと tag が空になり、renotify と合わせると showNotification が投げる
    if (message?.title) return { url: '/', ...message };
  } catch {
    // 読めない中身。下の形で出す
  }
  return { title: 'Liveeen', url: '/' };
}

self.addEventListener('push', (event) => {
  const message = readMessage(event);
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      data: { url: message.url },
      icon: '/icon-192x192.png',
      // Android の通知の帯に出す。色は使われず、形だけが出る（design/README.md）
      badge: '/notification-badge.png',
      // 同じ配信者の知らせは1つにまとめる。まとめても、また配信を始めたことは音で知らせる
      tag: message.url,
      renotify: true,
    }),
  );
});

// 通知を押したら、その配信を開く。もう開いているタブがあればそこへ移る
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((window) => window.url === url);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});

// ブラウザが送り口を取り替えたら、同じ鍵で取り直してサーバーに知らせる（鯉魂と同じ）。
// 知らせないと、サーバーは捨てられた送り口に送り続け、通知が届かなくなる（src/app/api/push/renew/route.ts）。
// 前の送り口を渡さないブラウザ（Chromium や Safari では渡さないことがある）では、どの行かが分からないので何もしない。
// その人は設定で切に見えるので、入れ直せば届く
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      const key = old?.options?.applicationServerKey;
      if (!old || !key) return;
      const next =
        event.newSubscription ??
        (await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }));
      const { endpoint, keys } = next.toJSON();
      await fetch('/api/push/renew', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ oldEndpoint: old.endpoint, endpoint, keys }),
      });
    })(),
  );
});
