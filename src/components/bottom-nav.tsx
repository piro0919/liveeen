'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { isActiveTab, showsBottomNav } from '@/lib/bottom-nav';
import { ui } from '@/lib/ui';
import { Avatar } from './avatar';
import { BroadcastIcon, FollowingIcon, HomeIcon, MyPageIcon, SearchIcon } from './nav-icons';

/**
 * スマホの下のタブ。手本は YouTube のスマホ版で、高さ 57px・アイコン 24px・字 11px・等幅（2026-11-01 に測った）。
 * ログインしている人の「マイページ」は本人の印にする。広い画面には出さない（上の帯にある）
 */
export function BottomNav({ mark }: { mark: { name: string; src: string | null } | null }) {
  const t = useTranslations('header');
  const pathname = usePathname();
  if (!showsBottomNav(pathname)) return null;
  const tabs = [
    { href: '/', label: t('home'), icon: <HomeIcon /> },
    { href: '/search', label: t('search'), icon: <SearchIcon /> },
    { href: '/following', label: t('following'), icon: <FollowingIcon /> },
    { href: '/broadcast', label: t('broadcast'), icon: <BroadcastIcon /> },
    {
      href: '/settings',
      label: t('myPage'),
      icon: mark ? <Avatar name={mark.name} src={mark.src} size="xs" /> : <MyPageIcon />,
    },
  ];
  return (
    <nav aria-label={t('menu')} className={ui.bottomBar}>
      <div className="flex">
        {tabs.map(({ href, label, icon }) => {
          const active = isActiveTab(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={active ? ui.bottomTabActive : ui.bottomTab}
            >
              {icon}
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
