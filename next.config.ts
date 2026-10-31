import type { NextConfig } from 'next';
// 環境変数を確かめる。欠けていればビルドの頭で止まる
import './src/env';

const nextConfig: NextConfig = {
  // スマホから手元の開発サーバーを開くため（http://MacBook-Pro.local:3000 のように Mac の名前で開く）
  allowedDevOrigins: ['*.local'],
  // 管理画面がコメントの中継につなぐのに使う（src/lib/comment-removal.ts）。
  // 束ねると、ws が任意で読む bufferutil の扱いが崩れることがあるので、束ねずに読ませる
  serverExternalPackages: ['ws'],
};

export default nextConfig;
