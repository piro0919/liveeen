import Link from 'next/link';
import { ui } from '@/lib/ui';

/** どの画面にも出す下の帯。利用規約とプライバシーポリシーへ（YouTube もサイドバーの下に小さく並べる） */
export function SiteFooter() {
  return (
    <footer className={`mt-auto flex gap-4 px-4 py-6 sm:px-6 ${ui.note}`}>
      <Link href="/terms" className="hover:text-foreground">
        利用規約
      </Link>
      <Link href="/privacy" className="hover:text-foreground">
        プライバシーポリシー
      </Link>
    </footer>
  );
}
