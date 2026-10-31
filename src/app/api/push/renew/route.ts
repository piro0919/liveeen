import { z } from 'zod';
import { renewPushSubscription } from '@/lib/push';
import { isPushServiceEndpoint } from '@/lib/push-message';

const DONE = 200;
const BAD_REQUEST = 400;

/** 新しい送り口と、ブラウザが捨てた前の送り口 */
const renewal = z.object({
  oldEndpoint: z.string().min(1),
  endpoint: z.url().refine(isPushServiceEndpoint),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/**
 * ブラウザが送り口を取り替えたとき（pushsubscriptionchange）に、public/sw.js が呼ぶ（鯉魂と同じ考え）。
 * 前の送り口の行を、新しい送り口に書き換える。ログインは要らない（service worker は画面を開かずに動く）。
 * 前の送り口の住所を知っていることを、その行の持ち主である証にする（ブラウザと通知の仕組みしか知らない長い住所）
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = renewal.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: BAD_REQUEST });
  const { oldEndpoint, endpoint, keys } = parsed.data;
  await renewPushSubscription(oldEndpoint, { endpoint, ...keys });
  return new Response(null, { status: DONE });
}
