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
    // 配信サーバーの API の合言葉。本番は Caddy が `/v3/` にこれを Bearer で求める（deploy/Caddyfile）。
    // 手元の MediaMTX は合言葉なしで API を通すので、手元では無くてよい
    MEDIA_API_SECRET: z.string().min(SECRET_MIN).optional(),
    // コメントを書く札の署名の鍵（src/lib/comment-token.ts）。中継（relay/）にも同じものを入れる。
    // 無ければ誰もコメントを書けない（読むことはできる）
    COMMENT_TOKEN_SECRET: z.string().min(SECRET_MIN).optional(),
    // 管理画面（/admin）を開ける人の Google のメールアドレス。カンマで区切る。無ければ誰も開けない
    ADMIN_EMAILS: z.string().optional(),
    // ブラウザ通知（Web Push）の VAPID の秘密の鍵と、送り口に名乗る連絡先（mailto:…）。
    // NEXT_PUBLIC_VAPID_PUBLIC_KEY と組で作る（web-push generate-vapid-keys）。無ければ通知は送らない
    VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    VAPID_SUBJECT: z.string().startsWith('mailto:').optional(),
    // 配信の始まりを知らせるメール（src/lib/email.ts）。Resend の API の鍵と、送り主（`Liveeen <…@…>`）。
    // 送り主のドメインは Resend で確かめておく。どちらか無ければメールは送らず、設定にも切り替えを出さない。
    // メールの中の住所は BETTER_AUTH_URL（サイトの住所）から作る
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    // 月の上限（src/lib/transfer.ts）。Akamai の API の鍵（読むのは account の転送量だけ）、配信サーバーの月の料金（ドル）、
    // 1ドルの円。どれか無ければ上限を確かめない。AKAMAI_REGION は転送量を地域ごとに数える地域のとき、その id
    AKAMAI_API_TOKEN: z.string().min(1).optional(),
    AKAMAI_REGION: z.string().min(1).optional(),
    MEDIA_SERVER_FEE_USD: z.coerce.number().nonnegative().optional(),
    YEN_PER_USD: z.coerce.number().positive().optional(),
  },
  client: {
    // 配信サーバー（MediaMTX）の住所。手元は compose.yaml
    // OBS の RTMP の受け口（rtmp://…）
    NEXT_PUBLIC_MEDIA_RTMP_URL: z.string().min(1),
    // WebRTC の受け口（WHIP と WHEP。http(s)://…）
    NEXT_PUBLIC_MEDIA_WEBRTC_URL: z.url(),
    // HLS の受け口（http(s)://…）
    NEXT_PUBLIC_MEDIA_HLS_URL: z.url(),
    // コメントの中継（relay/）の住所（ws(s)://…）。手元は pnpm relay
    NEXT_PUBLIC_COMMENT_RELAY_URL: z.url(),
    // ブラウザ通知（Web Push）の VAPID の公開の鍵。無ければ設定に通知の切り替えを出さない
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    MEDIA_TOKEN_SECRET: process.env.MEDIA_TOKEN_SECRET,
    MEDIA_API_URL: process.env.MEDIA_API_URL,
    MEDIA_API_SECRET: process.env.MEDIA_API_SECRET,
    COMMENT_TOKEN_SECRET: process.env.COMMENT_TOKEN_SECRET,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    AKAMAI_API_TOKEN: process.env.AKAMAI_API_TOKEN,
    AKAMAI_REGION: process.env.AKAMAI_REGION,
    MEDIA_SERVER_FEE_USD: process.env.MEDIA_SERVER_FEE_USD,
    YEN_PER_USD: process.env.YEN_PER_USD,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_COMMENT_RELAY_URL: process.env.NEXT_PUBLIC_COMMENT_RELAY_URL,
    NEXT_PUBLIC_MEDIA_RTMP_URL: process.env.NEXT_PUBLIC_MEDIA_RTMP_URL,
    NEXT_PUBLIC_MEDIA_WEBRTC_URL: process.env.NEXT_PUBLIC_MEDIA_WEBRTC_URL,
    NEXT_PUBLIC_MEDIA_HLS_URL: process.env.NEXT_PUBLIC_MEDIA_HLS_URL,
  },
  emptyStringAsUndefined: true,
});
