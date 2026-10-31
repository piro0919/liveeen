import type { Metadata } from 'next';
import { BlockList } from '@/components/block-list';
import { BroadcastSetup } from '@/components/broadcast-setup';
import { DisplayNameForm } from '@/components/display-name-form';
import { HandleForm } from '@/components/handle-form';
import { SignInButton } from '@/components/sign-in-button';
import { blocksOf } from '@/lib/blocks';
import { channelOf } from '@/lib/channels';
import { displayNameOf, handleOf } from '@/lib/profiles';
import { currentUserId } from '@/lib/session';
import { env } from '@/env';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: '配信する | Liveeen' };

/**
 * 配信を始める画面。配信はログインが要る。名前は配信の一覧に出るので、まだ付けていなければ先に付けてもらう。
 * 名前の次に、配信の住所になるハンドルを選んでもらう（チャンネルを作る前の人も、もう作ってある人も）
 */
export default async function BroadcastPage() {
  const userId = await currentUserId();
  const channel = userId ? await channelOf(userId) : null;
  const displayName = userId ? await displayNameOf(userId) : null;
  const handle = userId ? await handleOf(userId) : null;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className={ui.heading}>配信する</h1>
      {userId && !displayName ? (
        <div className={ui.card}>
          <DisplayNameForm name={null} />
        </div>
      ) : userId && !handle ? (
        <div className={ui.card}>
          <HandleForm handle={null} />
        </div>
      ) : userId ? (
        <>
          <BroadcastSetup
            channel={channel}
            webrtcUrl={env.NEXT_PUBLIC_MEDIA_WEBRTC_URL}
            relayUrl={env.NEXT_PUBLIC_COMMENT_RELAY_URL}
          />
          {channel && <BlockList blocks={await blocksOf(channel.id)} />}
        </>
      ) : (
        <SignInButton />
      )}
    </main>
  );
}
