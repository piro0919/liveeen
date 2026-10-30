import 'server-only';
import { headers } from 'next/headers';
import { getAuth } from './auth';
import { env } from '@/env';

/** ログインしている人の id。していなければ null。ログインの鍵が入っていない環境でも null */
export async function currentUserId(): Promise<string | null> {
  if (!env.BETTER_AUTH_SECRET || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}
