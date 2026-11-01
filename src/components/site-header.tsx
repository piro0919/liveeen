import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ui } from '@/lib/ui';
import { currentUserMark } from '@/lib/user-mark';
import { Avatar } from './avatar';
import { LogoMark } from './logo-mark';
import { SearchIcon } from './nav-icons';
import { PhoneHeaderLinks } from './phone-header-links';
import { SignInButton } from './sign-in-button';

/**
 * どの画面にも出す上の帯。画面の幅いっぱいで、上に貼りつく。左に印とロゴ、右にログイン。
 * 広い画面では検索と、ログインしていれば「フォロー中」「配信する」と本人の印（マイページへ）も出す。スマホでは下のタブにある（src/components/bottom-nav.tsx）
 */
export async function SiteHeader() {
  const t = await getTranslations('header');
  const mark = await currentUserMark();
  return (
    <header className={`sticky top-0 z-10 ${ui.headerBar}`}>
      <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-logo text-xl tracking-tight">
          <LogoMark className="h-6 w-auto text-live" />
          Liveeen
        </Link>
        <div className="flex items-center gap-2">
          <PhoneHeaderLinks mark={mark} />
          <div className="hidden items-center gap-2 sm:flex">
            <Link href="/search" aria-label={t('search')} className={ui.iconButton}>
              <SearchIcon className="size-5" />
            </Link>
            {mark && (
              <>
                <Link href="/following" className={ui.tonalButton}>
                  {t('following')}
                </Link>
                <Link href="/broadcast" className={ui.tonalButton}>
                  {t('broadcast')}
                </Link>
                {/* 素の a のままだと中の印が文字の行に乗り、下に字の下がりの分の隙間ができて印が 3px 上にずれる */}
                <Link href="/settings" aria-label={t('myPage')} className="flex">
                  <Avatar name={mark.name} src={mark.src} size="md" />
                </Link>
              </>
            )}
          </div>
          {!mark && <SignInButton variant="header" />}
        </div>
      </div>
    </header>
  );
}
