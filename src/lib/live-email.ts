import { outsideTranslator } from './outside-messages';
import { channelPath } from './handle';
import type { LiveStarted } from './push-message';

/** Resend の一括送信の1回に入れられる数（https://resend.com/docs/api-reference/emails/send-batch-emails） */
export const EMAILS_PER_BATCH = 100;

/** Resend の一括送信に渡す1通 */
export type Email = {
  from: string;
  to: string;
  subject: string;
  text: string;
  headers: Record<string, string>;
};

/** 送り先。unsubscribeToken はメールを止める札（src/lib/unsubscribe-token.ts） */
export type Recipient = { email: string; unsubscribeToken: string };

/** メールを止める受け口（src/app/api/email/unsubscribe/route.ts） */
function unsubscribeUrl(siteUrl: string, token: string): string {
  const url = new URL('/api/email/unsubscribe', siteUrl);
  url.searchParams.set('token', token);
  return url.href;
}

/**
 * 配信が始まったことを知らせるメール。送り先ごとに1通。
 * 文面はブラウザ通知（src/lib/push-message.ts）にそろえ、配信の住所と、知らせ方を変える設定の住所を添える。
 * メールの画面の「配信停止」から1回で止められるよう、List-Unsubscribe と List-Unsubscribe-Post を付ける
 * （RFC 8058。受け口は POST で止め、GET では止めない）
 */
export function liveStartedEmails({
  channelId,
  displayName,
  handle,
  siteUrl,
  from,
  to,
}: LiveStarted & {
  siteUrl: string;
  from: string;
  to: Recipient[];
}): Email[] {
  const t = outsideTranslator('liveEmail');
  const name = displayName ?? channelId;
  const subject = t('subject', { name });
  const text = [
    t('body', { name }),
    '',
    new URL(channelPath({ id: channelId, handle }), siteUrl).href,
    '',
    t('unsubscribe'),
    new URL('/settings', siteUrl).href,
  ].join('\n');
  return to.map((recipient) => ({
    from,
    to: recipient.email,
    subject,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl(siteUrl, recipient.unsubscribeToken)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }));
}

/** EMAILS_PER_BATCH ずつに分ける */
export function batchesOf<T>(items: T[]): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += EMAILS_PER_BATCH) {
    batches.push(items.slice(start, start + EMAILS_PER_BATCH));
  }
  return batches;
}
