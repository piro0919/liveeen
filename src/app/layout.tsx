import type { Metadata } from 'next';
import { Unbounded } from 'next/font/google';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

/** ロゴの書体（Liveeen の英字だけ） */
const unbounded = Unbounded({ weight: '700', subsets: ['latin'], variable: '--font-unbounded' });

export const metadata: Metadata = {
  title: 'Liveeen',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ja" className={`h-full antialiased ${unbounded.variable}`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
