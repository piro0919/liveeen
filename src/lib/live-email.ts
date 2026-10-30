/** Resend の一括送信の1回に入れられる数（https://resend.com/docs/api-reference/emails/send-batch-emails） */
export const EMAILS_PER_BATCH = 100;

/** Resend の一括送信に渡す1通 */
export type Email = { from: string; to: string; subject: string; text: string };

/**
 * 配信が始まったことを知らせるメール。送り先ごとに1通。
 * 文面はブラウザ通知（src/lib/push-message.ts）にそろえ、配信の住所と、知らせ方を変える設定の住所を添える
 */
export function liveStartedEmails({
  channelId,
  displayName,
  siteUrl,
  from,
  to,
}: {
  channelId: string;
  displayName: string | null;
  siteUrl: string;
  from: string;
  to: string[];
}): Email[] {
  const name = displayName ?? channelId;
  const subject = `${name} さんが配信を始めました`;
  const text = [
    `${name} さんが Liveeen で配信を始めました。`,
    '',
    new URL(`/${channelId}`, siteUrl).href,
    '',
    'このメールを止めるときは、設定の「メールで知らせる」を切ってください。',
    new URL('/settings', siteUrl).href,
  ].join('\n');
  return to.map((address) => ({ from, to: address, subject, text }));
}

/** EMAILS_PER_BATCH ずつに分ける */
export function batchesOf<T>(items: T[]): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += EMAILS_PER_BATCH) {
    batches.push(items.slice(start, start + EMAILS_PER_BATCH));
  }
  return batches;
}
