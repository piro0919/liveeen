import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ui } from '@/lib/ui';

/** どの画面にも出す下の帯。利用規約とプライバシーポリシーへ（YouTube もサイドバーの下に小さく並べる） */
export function SiteFooter() {
  const t = useTranslations('footer');
  return (
    <footer className={`mt-auto flex gap-4 px-4 py-6 sm:px-6 ${ui.note}`}>
      <Link href="/terms" className="hover:text-foreground">
        {t('terms')}
      </Link>
      <Link href="/privacy" className="hover:text-foreground">
        {t('privacy')}
      </Link>
    </footer>
  );
}
