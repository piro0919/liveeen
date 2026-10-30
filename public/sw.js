// ブラウザ通知（Web Push）を受け取る service worker。設定（/settings）で通知を入れたときに登録する。
// 送ってくる中身の形は src/lib/push-message.ts

self.addEventListener('push', (event) => {
  const message = event.data?.json();
  if (!message) return;
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      data: { url: message.url },
      // 同じ配信者の知らせは1つにまとめる
      tag: message.url,
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
