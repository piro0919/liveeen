import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Comments } from '@/components/comments';
import { FollowButton } from '@/components/follow-button';
import { Avatar } from '@/components/avatar';
import { Player, PlayerMessage } from '@/components/player';
import { ReportButton } from '@/components/report-button';
import { channelByHandle, channelById, channelOf } from '@/lib/channels';
import { isFollowing } from '@/lib/follows';
import { channelPath, handleOfSegment } from '@/lib/handle';
import { liveStream } from '@/lib/live';
import { displayNameOf } from '@/lib/profiles';
import { hasReported } from '@/lib/reports';
import { currentUserId } from '@/lib/session';
import { viewingCapReached } from '@/lib/transfer';
import { ui } from '@/lib/ui';
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
  // 上限に届くと配信サーバーが視聴を断るので、つなぎに行かずに理由を出す
  const capReached = await viewingCapReached();
  const name = channel.displayName ?? channel.id;
  // 手本は YouTube の視聴画面：左に映像と配信者、右にコメント。狭い画面では縦に並べる
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {capReached ? (
          <div className={ui.videoFrame}>
            <PlayerMessage>今月の視聴の上限に達したため、いまは見られません</PlayerMessage>
          </div>
        ) : (
          <Player
            channelId={channel.id}
            latencyMode={channel.latencyMode}
            hlsUrl={env.NEXT_PUBLIC_MEDIA_HLS_URL}
            webrtcUrl={env.NEXT_PUBLIC_MEDIA_WEBRTC_URL}
          />
        )}
        {/* スマホの幅でも1行に収める。名前とフォローの組が残りの幅を取り、名前は入りきらなければ省く。通報の理由を選ぶ欄だけが次の行に出る */}
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name={name} size="lg" />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex min-w-0 flex-col">
              <h1 className="truncate font-bold">{name}</h1>
              {channel.handle && <span className={`truncate ${ui.note}`}>@{channel.handle}</span>}
            </div>
            {!own && <FollowButton channelId={channel.id} following={following} />}
          </div>
          {!own && <ReportButton channelId={channel.id} reported={reported} />}
        </div>
      </div>
      {/* 広い画面では、コメントの枠を左の列（映像と配信者）と同じ高さにする。中身の多さで伸びないように、中は枠いっぱいに置く */}
      <aside className="relative h-128 lg:h-auto lg:w-100 lg:shrink-0">
        <div className="absolute inset-0 flex flex-col">
          <Comments
            channelId={channel.id}
            relayUrl={env.NEXT_PUBLIC_COMMENT_RELAY_URL}
            viewer={viewer}
            guestComments={channel.guestComments}
            own={own}
          />
        </div>
      </aside>
    </main>
  );
}
