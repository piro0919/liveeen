import type { Metadata } from 'next';
import { BroadcastSetup } from '@/components/broadcast-setup';
import { SignInButton } from '@/components/sign-in-button';
import { channelOf } from '@/lib/channels';
import { currentUserId } from '@/lib/session';
import { env } from '@/env';

export const metadata: Metadata = { title: '配信する | Liveeen' };

/** 配信を始める画面。配信はログインが要る */
export default async function BroadcastPage() {
  const userId = await currentUserId();
  const channel = userId ? await channelOf(userId) : null;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <h1 className="text-xl font-bold">配信する</h1>
      {userId ? (
        <BroadcastSetup
          channelId={channel?.id ?? null}
          rtmpUrl={env.NEXT_PUBLIC_MEDIA_RTMP_URL}
          webrtcUrl={env.NEXT_PUBLIC_MEDIA_WEBRTC_URL}
        />
      ) : (
        <SignInButton />
      )}
    </main>
  );
}
