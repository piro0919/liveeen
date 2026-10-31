import 'server-only';
import { adminEmailList } from './admin-emails';
import { type ReportedKind, reportNotice } from './report-notice-text';
import { env } from '@/env';

/** Resend の1通の送信の受け口（https://resend.com/docs/api-reference/emails/send-email） */
const RESEND_EMAIL_URL = 'https://api.resend.com/emails';

/** Resend が答えないとき、待つ上限 */
const SEND_TIMEOUT_MS = 10_000;

/**
 * 通報が来たことを運営（ADMIN_EMAILS）にメールで知らせる（shodolog・onigiri と同じ考え）。
 * 運営が管理画面を開くまで気づけないのを避ける。同じ配信・同じコメントへの通報は1件目だけ知らせる（何人に通報されても1通）。
 * 送れなくても通報は残っているので、ログに残して先へ進む。メールを送る用意が無ければ何もしない
 */
export async function notifyAdminsOfReport(
  kind: ReportedKind,
  reasonName: string | null,
): Promise<void> {
  const admins = adminEmailList(env.ADMIN_EMAILS);
  if (admins.length === 0 || !env.RESEND_API_KEY || !env.EMAIL_FROM || !env.BETTER_AUTH_URL) {
    return;
  }
  const notice = reportNotice(kind, reasonName, `${env.BETTER_AUTH_URL}/admin`);
  const response = await fetch(RESEND_EMAIL_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: admins, ...notice }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  }).catch((error: unknown) => {
    console.error('通報を運営に知らせられませんでした', error);
    return null;
  });
  if (response && !response.ok) {
    console.error('通報を運営に知らせられませんでした', response.status, await response.text());
  }
}
