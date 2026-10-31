import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Comments } from '@/components/comments';
import { ObsSetup } from '@/components/obs-setup';
import { StreamTitleForm } from '@/components/stream-title-form';
import { ViewerCount } from '@/components/viewer-count';
import { channelOf } from '@/lib/channels';
import { currentUserId } from '@/lib/session';
import { env } from '@/env';
import { ui } from '@/lib/ui';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('obs'))('title') };
}

/**
 * OBS で配信する人の画面。OBS に入れる設定と、配信しながら読むコメント。
 * チャンネルがまだ無ければ、作るところ（/broadcast）へ戻す
 */
export default async function ObsPage() {
  const t = await getTranslations('obs');
  const userId = await currentUserId();
  const channel = userId ? await channelOf(userId) : null;
  if (!channel) redirect('/broadcast');
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className={ui.heading}>{t('heading')}</h1>
      <p>
        {t.rich('back', {
          link: (chunks) => (
            <Link href="/broadcast" className={ui.link}>
              {chunks}
            </Link>
          ),
        })}
      </p>
      {/* OBS の人は配信しながらこの画面を開いているので、ここでもタイトルを変えられるようにする */}
      <div className={ui.card}>
        <StreamTitleForm title={channel.title} />
      </div>
      <ObsSetup
        channelId={channel.id}
        latencyMode={channel.latencyMode}
        rtmpUrl={env.NEXT_PUBLIC_MEDIA_RTMP_URL}
        whipUrl={`${env.NEXT_PUBLIC_MEDIA_WEBRTC_URL}/${channel.id}/whip`}
      />
      <ViewerCount channelId={channel.id} className={ui.note} />
      {/* 配信しながらコメントを読む。高さを決め、増えたら中で流す */}
      <div className="flex h-96">
        <Comments
          channelId={channel.id}
          relayUrl={env.NEXT_PUBLIC_COMMENT_RELAY_URL}
          viewer="ready"
          guestComments={channel.guestComments}
          own
          reportedComments={null}
        />
      </div>
    </main>
  );
}
