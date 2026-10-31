import { withSentryConfig } from '@sentry/nextjs/config';
import { withBotId } from 'botid/next/config';
import type { NextConfig } from 'next';
// 環境変数を確かめる。欠けていればビルドの頭で止まる
import './src/env';

const nextConfig: NextConfig = {
  // スマホから手元の開発サーバーを開くため（http://MacBook-Pro.local:3000 のように Mac の名前で開く）
  allowedDevOrigins: ['*.local'],
  // 管理画面がコメントの中継につなぐのに使う（src/lib/comment-removal.ts）。
  // 束ねると、ws が任意で読む bufferutil の扱いが崩れることがあるので、束ねずに読ませる
  serverExternalPackages: ['ws'],
  // 配信者ごとの共有の画像（src/lib/og-image.tsx）が読むファイル。readFile で読むものは自動では関数に入らない
  outputFileTracingIncludes: {
    '/[channelId]/opengraph-image': ['./src/app/globals.css', './design/unbounded-bold-logo.ttf'],
  },
  // onigiri と同じ安全用のヘッダー
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // ほかのサイトの枠に入れさせない
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

// ボットの判定（Vercel BotID、src/lib/bot.ts）の受け口を足す
// サーバーで落ちたことを Sentry へ送る（src/instrumentation.ts）。ソースマップは送らない（SENTRY_AUTH_TOKEN を置いていない）
export default withSentryConfig(withBotId(nextConfig), {
  silent: !process.env.CI,
  // ビルドのたびに SDK の使われ方を Sentry へ送るのを止める。要るのは落ちた知らせだけ
  telemetry: false,
});
