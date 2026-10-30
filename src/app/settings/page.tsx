import type { Metadata } from 'next';
import { DisplayNameForm } from '@/components/display-name-form';
import { FollowNoticeChoice } from '@/components/follow-notice-choice';
import { SignInButton } from '@/components/sign-in-button';
import { listsFollowedOnTop } from '@/lib/follows';
import { displayNameOf } from '@/lib/profiles';
import { currentUserId } from '@/lib/session';
import { env } from '@/env';

export const metadata: Metadata = { title: '設定 | Liveeen' };

/** 設定。名前と、フォローした人の配信の知らせ方 */
export default async function SettingsPage() {
  const userId = await currentUserId();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <h1 className="text-xl font-bold">設定</h1>
      {userId ? (
        <>
          <DisplayNameForm name={await displayNameOf(userId)} />
          <FollowNoticeChoice
            listOnTop={await listsFollowedOnTop(userId)}
            pushPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
          />
        </>
      ) : (
        <SignInButton />
      )}
    </main>
  );
}
