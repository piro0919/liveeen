import type { MetadataRoute } from 'next';
import { env } from '@/env';

/**
 * 検索に載せるのはトップ・配信者のページ・規約。受け口（/api）と、ログインした人だけの画面はクローラーに踏ませない。
 * 配信者のページの一覧は sitemap.ts
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.BETTER_AUTH_URL ?? 'http://localhost:3000';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/broadcast', '/settings'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
