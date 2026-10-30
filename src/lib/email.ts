import 'server-only';
import { db } from './db';
import { batchesOf, liveStartedEmails } from './live-email';
import { signUnsubscribeToken } from './unsubscribe-token';
import { env } from '@/env';

/** Resend の一括送信の受け口（https://resend.com/docs/api-reference/emails/send-batch-emails） */
const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch';

/** Resend が答えないとき、待つ上限 */
const SEND_TIMEOUT_MS = 10_000;

/**
 * メールを送る用意があるか。Resend の鍵と、送り主のアドレスと、サイトの住所がそろっているとき。
 * メールを止める札の署名にログインの鍵（BETTER_AUTH_SECRET）も使う
 */
export function emailEnabled(): boolean {
  return Boolean(
    env.RESEND_API_KEY && env.EMAIL_FROM && env.BETTER_AUTH_URL && env.BETTER_AUTH_SECRET,
  );
}

/**
 * チャンネルが配信を始めたことを、フォローしてメールを入れた人へ送る。送り先はログインに使った Google のメールアドレス。
 * 一括送信の1回に100通まで。1秒に10回までなので、1回ずつ順に送る
 */
export async function sendLiveEmails(channelId: string, displayName: string | null): Promise<void> {
  const secret = env.BETTER_AUTH_SECRET;
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !env.BETTER_AUTH_URL || !secret) return;
  const { rows } = await db().query<{ userId: string; email: string }>(
    `select "user".id as "userId", "user".email
     from follow
     join notification_setting on notification_setting.user_id = follow.user_id
     join "user" on "user".id = follow.user_id
     where follow.channel_id = $1 and notification_setting.email`,
    [channelId],
  );
  const emails = liveStartedEmails({
    channelId,
    displayName,
    siteUrl: env.BETTER_AUTH_URL,
    from: env.EMAIL_FROM,
    to: rows.map((row) => ({
      email: row.email,
      unsubscribeToken: signUnsubscribeToken(secret, row.userId),
    })),
  });
  for (const batch of batchesOf(emails)) {
    const response = await fetch(RESEND_BATCH_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error('メールを送れませんでした', response.status, await response.text());
    }
  }
}
