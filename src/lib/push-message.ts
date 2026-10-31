import { outsideTranslator } from './outside-messages';
import { channelPath } from './handle';

/**
 * ブラウザ通知（Web Push）で送る中身。受け取ったブラウザの public/sw.js が、この形を読んで通知を出す
 */
export type PushMessage = { title: string; body: string; url: string };

/** 配信を始めたチャンネル。知らせ（ブラウザ通知とメール）に使う。名前とハンドルは、まだ無ければ null */
export type LiveStarted = { channelId: string; displayName: string | null; handle: string | null };

/** 配信が始まったことを知らせる中身。名前より先に作られたチャンネルは id を名前の代わりにする */
export function liveStartedMessage({ channelId, displayName, handle }: LiveStarted): PushMessage {
  const t = outsideTranslator('livePush');
  return {
    title: t('title', { name: displayName ?? channelId }),
    body: t('body'),
    url: channelPath({ id: channelId, handle }),
  };
}

const NOT_FOUND = 404;
const GONE = 410;

/**
 * 送り口がもう使えないことを示す答えか。見る人が通知を切ったり、ブラウザが送り口を捨てたりすると、
 * 送り口は 404 か 410 を返す（https://web.dev/articles/push-notifications-web-push-protocol）。そうなった送り口は消す
 */
export function subscriptionGone(statusCode: number): boolean {
  return statusCode === NOT_FOUND || statusCode === GONE;
}

/**
 * 通知を送ってよい宛先か（spatto と同じ一覧）。ブラウザ各社の通知の仕組みだけを通す。
 * 送り口はブラウザが返す住所で、その人が好きな値を送ってこられる。応答しないサーバーを登録されると、
 * 配信が始まったときの送信がそこで待たされる。Chrome 系（FCM。新しい Chromium は jmt と数字の google.com を返す）、
 * Firefox、Safari（Apple）、Edge（WNS）。登録するときと、送る直前の両方で見る
 */
export function isPushServiceEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return (
    host === 'fcm.googleapis.com' ||
    host === 'android.googleapis.com' ||
    /^jmt\d+\.google\.com$/.test(host) ||
    host === 'updates.push.services.mozilla.com' ||
    host.endsWith('.push.apple.com') ||
    host.endsWith('.notify.windows.com')
  );
}
