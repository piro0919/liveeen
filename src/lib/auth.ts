import 'server-only';
import { betterAuth } from 'better-auth';
import { db } from './db';
import { env } from '@/env';

/** セッションを Cookie に控えておく秒数（そのあいだは DB に聞かない） */
const SESSION_CACHE_SECONDS = 300;

/**
 * ログインの土台。Better Auth を自前で持つ（vocafy と同じ作り）。手段は Google だけ。
 * ユーザーとセッションは同じ Postgres の表に入る（db/migrations/0001_accounts.sql）。
 *
 * 初めて使うときに作る。読み込みの時点で作ると、鍵を持たないビルドや CI が落ちる
 */
function createAuth() {
  const { BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env;
  if (!BETTER_AUTH_SECRET || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'ログインの鍵がありません: BETTER_AUTH_SECRET・GOOGLE_CLIENT_ID・GOOGLE_CLIENT_SECRET を入れてください',
    );
  }
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    database: db(),
    secret: BETTER_AUTH_SECRET,
    socialProviders: {
      google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET },
    },
    // セッションは署名付きのクッキーに5分持たせ、そのあいだは DB を読みに行かない
    session: { cookieCache: { enabled: true, maxAge: SESSION_CACHE_SECONDS } },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  auth ??= createAuth();
  return auth;
}
