import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Comments } from '@/components/comments';
import { Player } from '@/components/player';
import { channelById } from '@/lib/channels';
import { displayNameOf } from '@/lib/profiles';
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
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <Player
        channelId={channel.id}
        latencyMode={channel.latencyMode}
        hlsUrl={env.NEXT_PUBLIC_MEDIA_HLS_URL}
        webrtcUrl={env.NEXT_PUBLIC_MEDIA_WEBRTC_URL}
      />
      <Comments
        channelId={channel.id}
        relayUrl={env.NEXT_PUBLIC_COMMENT_RELAY_URL}
        viewer={viewer}
        guestComments={channel.guestComments}
      />
    </main>
  );
}
