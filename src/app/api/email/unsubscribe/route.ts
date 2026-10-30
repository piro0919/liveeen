import { setEmailsLiveStarted } from '@/lib/follows';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token';
import { env } from '@/env';

const DONE = 200;
const BAD_REQUEST = 400;

/**
 * メールの「配信停止」（List-Unsubscribe-Post: List-Unsubscribe=One-Click、RFC 8058）。
 * メールの画面が札つきの住所に POST してくる。ログインは要らない。止めるのは配信開始のメールだけ
 */
export async function POST(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const userId = env.BETTER_AUTH_SECRET
    ? verifyUnsubscribeToken(env.BETTER_AUTH_SECRET, token)
    : null;
  if (!userId) return new Response(null, { status: BAD_REQUEST });
  await setEmailsLiveStarted(userId, false);
  return new Response(null, { status: DONE });
}

/**
 * 住所を開いただけでは止めない。メールの安全確認の仕組みが中の住所を先に開くことがあり、
 * 開いただけで止まると、本人が押していないのに止まる（RFC 8058）。設定の画面へ送る
 */
export function GET(request: Request): Response {
  return Response.redirect(new URL('/settings', request.url));
}
