/**
 * ブラウザ通知（Web Push）で送る中身。受け取ったブラウザの public/sw.js が、この形を読んで通知を出す
 */
export type PushMessage = { title: string; body: string; url: string };

/** 配信が始まったことを知らせる中身。名前より先に作られたチャンネルは id を名前の代わりにする */
export function liveStartedMessage(channelId: string, displayName: string | null): PushMessage {
  return {
    title: `${displayName ?? channelId} さんが配信を始めました`,
    body: 'タップして見る',
    url: `/${channelId}`,
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
