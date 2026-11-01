/** 受け取る service worker（public/sw.js） */
export const SERVICE_WORKER_URL = '/sw.js';

/** このブラウザの送り口。まだ作っていなければ null */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  return (await registration?.pushManager.getSubscription()) ?? null;
}
