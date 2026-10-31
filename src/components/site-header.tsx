import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { avatarOf } from '@/lib/avatars';
import { displayNameOf } from '@/lib/profiles';
import { currentUserId } from '@/lib/session';
import { ui } from '@/lib/ui';
import { Avatar } from './avatar';
import { LogoMark } from './logo-mark';
import { SignInButton } from './sign-in-button';

/**
 * どの画面にも出す上の帯。画面の幅いっぱいで、上に貼りつく。左に印とロゴ、右にログイン。
 * ログインしていれば「配信する」と、本人の印（設定へ）
 */
export async function SiteHeader() {
  const t = await getTranslations('header');
  const userId = await currentUserId();
  const [name, avatar] = userId
    ? await Promise.all([displayNameOf(userId), avatarOf(userId)])
    : [null, null];
  return (
    <header className={`sticky top-0 z-10 ${ui.headerBar}`}>
      <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-logo text-xl tracking-tight">
          <LogoMark className="h-6 w-auto text-live" />
          Liveeen
        </Link>
        {userId ? (
          <div className="flex items-center gap-2">
            <Link href="/broadcast" className={ui.tonalButton}>
              {t('broadcast')}
            </Link>
            {/* 素の a のままだと中の印が文字の行に乗り、下に字の下がりの分の隙間ができて印が 3px 上にずれる */}
            <Link href="/settings" aria-label={t('settings')} className="flex">
              <Avatar name={name ?? '?'} src={avatar?.src} size="md" />
            </Link>
          </div>
        ) : (
          <SignInButton variant="header" />
        )}
      </div>
    </header>
  );
}
