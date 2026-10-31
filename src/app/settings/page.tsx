import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AvatarForm } from '@/components/avatar-form';
import { DeleteAccountButton } from '@/components/delete-account-button';
import { DisplayNameForm } from '@/components/display-name-form';
import { FollowNoticeChoice } from '@/components/follow-notice-choice';
import { HandleForm } from '@/components/handle-form';
import { InstallApp } from '@/components/install-app';
import { SignInButton } from '@/components/sign-in-button';
import { SignOutButton } from '@/components/sign-out-button';
import { avatarOf } from '@/lib/avatars';
import { emailEnabled } from '@/lib/email';
import { emailsLiveStarted, listsFollowedOnTop } from '@/lib/follows';
import { displayNameOf, handleOf } from '@/lib/profiles';
import { currentUserId } from '@/lib/session';
import { env } from '@/env';
import { ui } from '@/lib/ui';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('settings'))('title') };
}

/** 設定。名前、アイコン、ハンドル（配信の画面で選んだ人だけ）、フォローした人の配信の知らせ方 */
export default async function SettingsPage() {
  const t = await getTranslations('settings');
  const userId = await currentUserId();
  const handle = userId ? await handleOf(userId) : null;
  const name = userId ? await displayNameOf(userId) : null;
  const avatar = userId ? await avatarOf(userId) : null;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className={ui.heading}>{t('heading')}</h1>
      {userId ? (
        <>
          <div className={ui.card}>
            <DisplayNameForm name={name} />
          </div>
          {avatar && (
            <div className={ui.card}>
              <AvatarForm name={name ?? '?'} {...avatar} />
            </div>
          )}
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
          <InstallApp />
          <SignOutButton />
          <DeleteAccountButton />
        </>
      ) : (
        <SignInButton />
      )}
    </main>
  );
}
