import type { MetadataRoute } from 'next';
import { channelPath } from '@/lib/handle';
import { listedChannels } from '@/lib/channels';
import { env } from '@/env';

// クローラーが来るたびに DB に聞かないよう、1時間ごとに作り直す（onigiri と同じ）
export const revalidate = 3600;

/**
 * 検索に知らせるページ（robots.ts が許している所）。配信者のページは、ハンドルを選んでいて、運営が止めていないものだけ。
 * 配信していない間も、その人のページはある
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.BETTER_AUTH_URL ?? 'http://localhost:3000';
  const channels = await listedChannels();
  return [
    ...['/', '/terms', '/privacy'].map((path) => ({ url: `${base}${path}` })),
    ...channels.map((channel) => ({ url: `${base}${channelPath(channel)}` })),
  ];
}
