import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Comments } from '@/components/comments';
import { FollowButton } from '@/components/follow-button';
import { Player } from '@/components/player';
import { ReportButton } from '@/components/report-button';
import { channelById, channelOf } from '@/lib/channels';
import { isFollowing } from '@/lib/follows';
import { liveStream } from '@/lib/live';
import { displayNameOf } from '@/lib/profiles';
import { hasReported } from '@/lib/reports';
import { currentUserId } from '@/lib/session';
import { env } from '@/env';

export const metadata: Metadata = { title: 'Liveeen' };

/** 配信者の住所。配信を見る画面。見るのにログインは要らない（CLAUDE.md）。コメントを書くにはログインと名前が要る */
export default async function ChannelPage({ params }: PageProps<'/[channelId]'>) {
  const { channelId } = await params;
  const channel = await channelById(channelId);
  if (!channel) notFound();
  const userId = await currentUserId();
  const viewer = !userId ? 'signed-out' : (await displayNameOf(userId)) ? 'ready' : 'no-name';
  // 自分のチャンネルはフォローも通報もできないので、ボタンを出さない
  const own = userId ? (await channelOf(userId))?.id === channel.id : false;
  const following = userId ? await isFollowing(userId, channel.id) : null;
  const live = userId && !own ? await liveStream(channel.id) : null;
  const reported = userId ? (live ? await hasReported(userId, live) : false) : null;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <Player
        channelId={channel.id}
        latencyMode={channel.latencyMode}
        hlsUrl={env.NEXT_PUBLIC_MEDIA_HLS_URL}
        webrtcUrl={env.NEXT_PUBLIC_MEDIA_WEBRTC_URL}
      />
      {!own && (
        <div className="flex flex-wrap items-center gap-2">
          <FollowButton channelId={channel.id} following={following} />
          <ReportButton channelId={channel.id} reported={reported} />
        </div>
      )}
      <Comments
        channelId={channel.id}
        relayUrl={env.NEXT_PUBLIC_COMMENT_RELAY_URL}
        viewer={viewer}
        guestComments={channel.guestComments}
      />
    </main>
  );
}
