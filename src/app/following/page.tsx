import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ChannelList } from '@/components/channel-list';
import { SignInButton } from '@/components/sign-in-button';
import { followedChannels } from '@/lib/channels';
import { currentUserId } from '@/lib/session';
import { ui } from '@/lib/ui';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('following'))('title') };
}

/** フォローしている配信者の一覧。配信していない人のページへも、ここから戻れる */
export default async function FollowingPage() {
  const t = await getTranslations('following');
  const userId = await currentUserId();
  const channels = userId ? await followedChannels(userId) : [];
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className={ui.heading}>{t('heading')}</h1>
      {!userId && <SignInButton />}
      {userId &&
        (channels.length > 0 ? (
          <ChannelList channels={channels} groupLive />
        ) : (
          <p className="text-muted">{t('empty')}</p>
        ))}
    </main>
  );
}
