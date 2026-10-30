import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/** 署名の鍵の長さの下限 */
const SECRET_MIN = 32;

/**
 * サイトが読む環境変数の検査。next.config.ts が読み込むので、欠けていればビルドの頭で止まる
 */
export const env = createEnv({
  server: {
    // 手元は compose.yaml の Postgres、本番は Neon（プールを通す接続文字列）
    DATABASE_URL: z.string().min(1),
    // ログイン（Better Auth と Google）。無くてもビルドは通す。
    // 欠けたままログインの受け口に来たら、そこで名前を挙げて止まる（src/lib/auth.ts）
    BETTER_AUTH_SECRET: z.string().min(SECRET_MIN).optional(),
    BETTER_AUTH_URL: z.url().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    // ブラウザからの配信に渡す札の署名の鍵（src/lib/media-token.ts）。無ければブラウザからは配信できない
    MEDIA_TOKEN_SECRET: z.string().min(SECRET_MIN).optional(),
    // 配信サーバー（MediaMTX）の API。トップの配信中の一覧を読む（src/lib/live.ts）
    MEDIA_API_URL: z.url(),
  },
  client: {
    // 配信サーバー（MediaMTX）の住所。手元は compose.yaml
    // OBS の RTMP の受け口（rtmp://…）
    NEXT_PUBLIC_MEDIA_RTMP_URL: z.string().min(1),
    // WebRTC の受け口（WHIP と WHEP。http(s)://…）
    NEXT_PUBLIC_MEDIA_WEBRTC_URL: z.url(),
    // HLS の受け口（http(s)://…）
    NEXT_PUBLIC_MEDIA_HLS_URL: z.url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    MEDIA_TOKEN_SECRET: process.env.MEDIA_TOKEN_SECRET,
    MEDIA_API_URL: process.env.MEDIA_API_URL,
    NEXT_PUBLIC_MEDIA_RTMP_URL: process.env.NEXT_PUBLIC_MEDIA_RTMP_URL,
    NEXT_PUBLIC_MEDIA_WEBRTC_URL: process.env.NEXT_PUBLIC_MEDIA_WEBRTC_URL,
    NEXT_PUBLIC_MEDIA_HLS_URL: process.env.NEXT_PUBLIC_MEDIA_HLS_URL,
  },
  emptyStringAsUndefined: true,
});
