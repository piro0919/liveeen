import 'server-only';
import { headers } from 'next/headers';
import { ipKeyOf } from './ip-key';

/**
 * いまの要求を送ってきた人の IP の鍵（src/lib/ip-key.ts）。分からなければ null。
 * Vercel は x-forwarded-for を自分で書き直すので、見る人が偽れない
 * （https://vercel.com/docs/headers/request-headers#x-forwarded-for）。先頭が見る人の IP
 */
export async function requestIpKey(secret: string): Promise<string | null> {
  const forwarded = (await headers()).get('x-forwarded-for');
  const ip = forwarded?.split(',')[0];
  return ip ? ipKeyOf(secret, ip) : null;
}
