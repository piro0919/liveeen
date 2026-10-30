import type { Metadata } from 'next';
import { DisplayNameForm } from '@/components/display-name-form';
import { SignInButton } from '@/components/sign-in-button';
import { displayNameOf } from '@/lib/profiles';
import { currentUserId } from '@/lib/session';

export const metadata: Metadata = { title: '設定 | Liveeen' };

/** 設定。いまは名前だけ */
export default async function SettingsPage() {
  const userId = await currentUserId();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <h1 className="text-xl font-bold">設定</h1>
      {userId ? <DisplayNameForm name={await displayNameOf(userId)} /> : <SignInButton />}
    </main>
  );
}
