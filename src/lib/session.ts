import 'server-only';
import { headers } from 'next/headers';
import { cache } from 'react';
import { getAuth } from './auth';
import { env } from '@/env';

/**
 * ログインしている人の id。していなければ null。ログインの鍵が入っていない環境でも null。
 * 上の帯とページの両方が聞くので、1回の表示では1度だけ引く
 */
export const currentUserId = cache(async (): Promise<string | null> => {
  if (!env.BETTER_AUTH_SECRET || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
});
