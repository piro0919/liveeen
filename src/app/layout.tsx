import type { Metadata } from 'next';
import { Unbounded } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { ExternalBrowser } from '@/components/external-browser';
import { PageAnalytics } from '@/components/page-analytics';
import { Progress } from '@/components/progress';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Toaster } from '@/components/toaster';
import { env } from '@/env';
import './globals.css';

/** ロゴの書体（Liveeen の英字だけ） */
const unbounded = Unbounded({ weight: '700', subsets: ['latin'], variable: '--font-unbounded' });

/**
 * 題と、共有したときのカード。画像は src/app/opengraph-image.png（元は design/og.html）。
 * 画像の住所はサイトの住所から作る。無いとき（手元）は Next.js が localhost を使う
 */
export const metadata: Metadata = {
  metadataBase: env.BETTER_AUTH_URL ? new URL(env.BETTER_AUTH_URL) : undefined,
  title: 'Liveeen',
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ja" className={`h-full antialiased ${unbounded.variable}`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <Progress>
            <SiteHeader />
            {children}
            <SiteFooter />
          </Progress>
          <Toaster />
        </NextIntlClientProvider>
        <PageAnalytics />
        <ExternalBrowser />
      </body>
    </html>
  );
}
