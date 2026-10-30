import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Player } from '@/components/player';
import { channelById } from '@/lib/channels';
import { env } from '@/env';

export const metadata: Metadata = { title: 'Liveeen' };

/** 配信者の住所。配信を見る画面。見るのにログインは要らない（CLAUDE.md） */
export default async function ChannelPage({ params }: PageProps<'/[channelId]'>) {
  const { channelId } = await params;
  const channel = await channelById(channelId);
  if (!channel) notFound();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <Player
        channelId={channel.id}
        latencyMode={channel.latencyMode}
        hlsUrl={env.NEXT_PUBLIC_MEDIA_HLS_URL}
        webrtcUrl={env.NEXT_PUBLIC_MEDIA_WEBRTC_URL}
      />
    </main>
  );
}
