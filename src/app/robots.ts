import type { MetadataRoute } from 'next';

/**
 * 検索に載せるのはトップ・配信者のページ・規約。受け口（/api）と、ログインした人だけの画面はクローラーに踏ませない
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/broadcast', '/settings'],
    },
  };
}
