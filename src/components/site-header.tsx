import Link from 'next/link';
import { displayNameOf } from '@/lib/profiles';
import { currentUserId } from '@/lib/session';
import { ui } from '@/lib/ui';
import { Avatar } from './avatar';
import { SignInButton } from './sign-in-button';

/**
 * どの画面にも出す上の帯。手本は YouTube：左にロゴ、右にログイン。
 * ログインしていれば、YouTube の「作成」の位置に「配信する」、アカウントの位置に名前の印（設定へ）
 */
export async function SiteHeader() {
  const userId = await currentUserId();
  const name = userId ? await displayNameOf(userId) : null;
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 bg-background px-4">
      <Link href="/" className="text-xl font-bold tracking-tight">
        Liveeen
      </Link>
      {userId ? (
        <div className="flex items-center gap-2">
          <Link href="/broadcast" className={ui.tonalButton}>
            配信する
          </Link>
          <Link href="/settings" aria-label="設定">
            <Avatar name={name ?? '?'} size="sm" />
          </Link>
        </div>
      ) : (
        <SignInButton label="ログイン" variant="header" />
      )}
    </header>
  );
}
