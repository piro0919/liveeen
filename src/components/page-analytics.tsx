'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';

/** 送る前に問い合わせの文字列（`?` から後ろ）を落とす。何が入ってきても閲覧数の記録に残さない */
export function redactAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: event.url.split('?')[0] };
}

/**
 * 閲覧数の集計（Vercel Web Analytics、onigiri と同じ形）。Cookie を使わない。
 * beforeSend は関数なので、サーバーのレイアウトからは渡せず、この部品で包む
 */
export function PageAnalytics() {
  return <Analytics beforeSend={redactAnalyticsEvent} />;
}
