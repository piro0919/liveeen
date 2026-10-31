import Link from 'next/link';
import { connection } from 'next/server';
import { Avatar } from '@/components/avatar';
import { LiveThumbnail } from '@/components/live-thumbnail';
import { followedAmong, listsFollowedOnTop } from '@/lib/follows';
import { channelPath } from '@/lib/handle';
import { type LiveChannel, liveChannels } from '@/lib/live';
import { splitFollowed } from '@/lib/live-paths';
import { currentUserId } from '@/lib/session';
import { thumbnailUrl } from '@/lib/thumbnail';
import { viewersLabel } from '@/lib/viewer-label';
import { viewerCounts } from '@/lib/viewers';
import { ui } from '@/lib/ui';
import { env } from '@/env';

/** 配信の始まった時刻。初版は日本向け（CLAUDE.md）なので日本の時刻で出す */
const startedAtFormat = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tokyo',
});

/**
 * 配信の札。16:9 の絵と、配信者の印・タイトル・名前・見ている人の数・始まった時刻。
 * 画像は中継が1分おきに撮る縮小画像（relay/thumbnails.ts）。まだ撮れていなければ名前の1文字を大きく出す
 */
function LiveCard({ channel, viewers }: { channel: LiveChannel; viewers: number | undefined }) {
  const name = channel.displayName ?? channel.channelId;
  const thumbnail = thumbnailUrl(env.NEXT_PUBLIC_COMMENT_RELAY_URL, channel.channelId);
  return (
    <li>
      <Link
        href={channelPath({ id: channel.channelId, handle: channel.handle })}
        className="group flex flex-col gap-3"
      >
        <div className={`flex items-center justify-center ${ui.thumbnail}`}>
          {/* 住所は1分ごとに変わる。変わったら撮れなかったことを忘れて、もう一度読ませる */}
          <LiveThumbnail key={thumbnail} name={name} src={thumbnail} />
          <span className={`absolute top-2 left-2 ${ui.liveTag}`}>
            <span
              aria-hidden
              className="size-1.5 animate-pulse rounded-xs bg-current motion-reduce:animate-none"
            />
            ライブ
          </span>
        </div>
        <div className="flex gap-3">
          <Avatar name={name} src={channel.avatar} />
          {/* 手本は YouTube の札：タイトルを太字で2行まで、その下に配信者の名前。タイトルが無ければ名前を太字にする */}
          <div className="flex min-w-0 flex-col">
            {channel.title ? (
              <>
                <span className="line-clamp-2 font-bold wrap-break-word group-hover:text-accent">
                  {channel.title}
                </span>
                <span className={`truncate ${ui.note}`}>{name}</span>
              </>
            ) : (
              <span className="truncate font-bold group-hover:text-accent">{name}</span>
            )}
            <span className={ui.note}>
              {/* 人数は中継が答えたときだけ。誰も開いていなければ載ってこない */}
              {viewers !== undefined && `${viewersLabel(viewers)} ・ `}
              {startedAtFormat.format(channel.startedAt)} から
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function LiveGrid({
  channels,
  viewers,
}: {
  channels: LiveChannel[];
  viewers: Map<string, number>;
}) {
  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {channels.map((channel) => (
        <LiveCard
          key={channel.channelId}
          channel={channel}
          viewers={viewers.get(channel.channelId)}
        />
      ))}
    </ul>
  );
}

/**
 * トップ。いま配信中の一覧（CLAUDE.md）。開くたびに配信サーバーに聞く。
 * ログインしていて、設定で切っていなければ、フォローしている配信を上に分けて出す
 */
export default async function Home() {
  await connection();
  const channels = await liveChannels();
  const viewers =
    channels.length > 0
      ? await viewerCounts(env.NEXT_PUBLIC_COMMENT_RELAY_URL)
      : new Map<string, number>();
  const userId = await currentUserId();
  const followed =
    userId && channels.length > 0 && (await listsFollowedOnTop(userId))
      ? await followedAmong(
          userId,
          channels.map((channel) => channel.channelId),
        )
      : new Set<string>();
  const split = splitFollowed(channels, followed);
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className={ui.heading}>配信中</h1>
      {channels.length === 0 && (
        <p className="flex flex-1 items-center justify-center py-24 text-muted">
          いま配信している人はいません
        </p>
      )}
      {split.followed.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className={ui.subheading}>フォロー中</h2>
          <LiveGrid channels={split.followed} viewers={viewers} />
        </section>
      )}
      {split.others.length > 0 && <LiveGrid channels={split.others} viewers={viewers} />}
    </main>
  );
}
