import type { Metadata } from 'next';
import { DeleteAccountButton } from '@/components/delete-account-button';
import { DisplayNameForm } from '@/components/display-name-form';
import { FollowNoticeChoice } from '@/components/follow-notice-choice';
import { HandleForm } from '@/components/handle-form';
import { SignInButton } from '@/components/sign-in-button';
import { SignOutButton } from '@/components/sign-out-button';
import { emailEnabled } from '@/lib/email';
import { emailsLiveStarted, listsFollowedOnTop } from '@/lib/follows';
import { displayNameOf, handleOf } from '@/lib/profiles';
import { currentUserId } from '@/lib/session';
import { env } from '@/env';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: '設定 | Liveeen' };

/** 設定。名前、ハンドル（配信の画面で選んだ人だけ）、フォローした人の配信の知らせ方 */
export default async function SettingsPage() {
  const userId = await currentUserId();
  const handle = userId ? await handleOf(userId) : null;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className={ui.heading}>設定</h1>
      {userId ? (
        <>
          <div className={ui.card}>
            <DisplayNameForm name={await displayNameOf(userId)} />
          </div>
          {handle && (
            <div className={ui.card}>
              <HandleForm handle={handle} />
            </div>
          )}
          <div className={ui.card}>
            <FollowNoticeChoice
              listOnTop={await listsFollowedOnTop(userId)}
              email={await emailsLiveStarted(userId)}
              emailEnabled={emailEnabled()}
              pushPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
            />
          </div>
          <SignOutButton />
          <DeleteAccountButton />
        </>
      ) : (
        <SignInButton />
      )}
    </main>
  );
}
