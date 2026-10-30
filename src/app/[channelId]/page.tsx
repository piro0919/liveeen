import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Comments } from '@/components/comments';
import { FollowButton } from '@/components/follow-button';
import { Player } from '@/components/player';
import { ReportButton } from '@/components/report-button';
import { channelByHandle, channelById, channelOf } from '@/lib/channels';
import { isFollowing } from '@/lib/follows';
import { channelPath, handleOfSegment } from '@/lib/handle';
import { liveStream } from '@/lib/live';
import { displayNameOf } from '@/lib/profiles';
import { hasReported } from '@/lib/reports';
import { currentUserId } from '@/lib/session';
import { env } from '@/env';

export const metadata: Metadata = { title: 'Liveeen' };

/**
 * 配信者の住所。配信を見る画面。見るのにログインは要らない（CLAUDE.md）。コメントを書くにはログインと名前が要る。
 * 住所は /@ハンドル。チャンネルの id の住所は、ハンドルがあればそちらへ送る（前に配った住所も開けるように）
 */
export default async function ChannelPage({ params }: PageProps<'/[channelId]'>) {
  const { channelId: segment } = await params;
  const handle = handleOfSegment(segment);
  const channel = handle ? await channelByHandle(handle) : await channelById(segment);
  if (!channel) notFound();
  // ハンドルは変えられるので、転送は恒久にしない
  if (channel.handle && handle !== channel.handle) redirect(channelPath(channel));
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
