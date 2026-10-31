import Link from 'next/link';
import { displayNameOf } from '@/lib/profiles';
import { currentUserId } from '@/lib/session';
import { ui } from '@/lib/ui';
import { Avatar } from './avatar';
import { SignInButton } from './sign-in-button';

/**
 * どの画面にも出す上の帯。画面の幅いっぱいで、上に貼りつく。左にロゴ、右にログイン。
 * ログインしていれば「配信する」と、名前の印（設定へ）
 */
export async function SiteHeader() {
  const userId = await currentUserId();
  const name = userId ? await displayNameOf(userId) : null;
  return (
    <header className={`sticky top-0 z-10 ${ui.headerBar}`}>
      <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-1.5 font-logo text-xl tracking-tight">
          Liveeen
          <span aria-hidden className="size-2 rounded-xs bg-live" />
        </Link>
        {userId ? (
          <div className="flex items-center gap-2">
            <Link href="/broadcast" className={ui.tonalButton}>
              配信する
            </Link>
            <Link href="/settings" aria-label="設定">
              <Avatar name={name ?? '?'} size="md" />
            </Link>
          </div>
        ) : (
          <SignInButton label="ログイン" variant="header" />
        )}
      </div>
    </header>
  );
}
