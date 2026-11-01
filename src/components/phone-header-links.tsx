'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { showsBottomNav } from '@/lib/bottom-nav';
import { ui } from '@/lib/ui';
import { Avatar } from './avatar';
import { SearchIcon } from './nav-icons';

/**
 * 下のタブが出ない画面（見る画面など）のスマホで、上の帯に出す検索と本人の印。
 * 無いと、ほかの画面へはロゴから戻るしかなく、どのアカウントで見ているかも分からない
 */
export function PhoneHeaderLinks({ mark }: { mark: { name: string; src: string | null } | null }) {
  const t = useTranslations('header');
  const pathname = usePathname();
  if (showsBottomNav(pathname)) return null;
  return (
    <div className="flex items-center gap-2 sm:hidden">
      <Link href="/search" aria-label={t('search')} className={ui.iconButton}>
        <SearchIcon className="size-5" />
      </Link>
      {mark && (
        <Link href="/settings" aria-label={t('myPage')} className="flex">
          <Avatar name={mark.name} src={mark.src} size="md" />
        </Link>
      )}
    </div>
  );
}
