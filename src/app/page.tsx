import Link from 'next/link';
import { connection } from 'next/server';
import { Avatar, initialOf } from '@/components/avatar';
import { followedAmong, listsFollowedOnTop } from '@/lib/follows';
import { channelPath } from '@/lib/handle';
import { type LiveChannel, liveChannels } from '@/lib/live';
import { splitFollowed } from '@/lib/live-paths';
import { currentUserId } from '@/lib/session';
import { ui } from '@/lib/ui';

/** 配信の始まった時刻。初版は日本向け（CLAUDE.md）なので日本の時刻で出す */
const startedAtFormat = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tokyo',
});

/**
 * 配信の札。手本は YouTube の「ライブ配信中」の並び。
 * 配信の縮小画像はまだ作れない（配信サーバーが画像を出さない）ので、画像の枠には名前の1文字を大きく出す
 */
function LiveCard({ channel }: { channel: LiveChannel }) {
  const name = channel.displayName ?? channel.channelId;
  return (
    <li>
      <Link
        href={channelPath({ id: channel.channelId, handle: channel.handle })}
        className="group flex flex-col gap-3"
      >
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-surface group-hover:bg-surface-hover">
          <span aria-hidden className="text-5xl font-bold text-muted">
            {initialOf(name)}
          </span>
          <span className="absolute bottom-2 left-2 rounded-sm bg-live px-1 text-xs font-medium text-white">
            ライブ
          </span>
        </div>
        <div className="flex gap-3">
          <Avatar name={name} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{name}</span>
            <span className={ui.note}>{startedAtFormat.format(channel.startedAt)} から</span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function LiveGrid({ channels }: { channels: LiveChannel[] }) {
  return (
    <ul className="grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {channels.map((channel) => (
        <LiveCard key={channel.channelId} channel={channel} />
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
    <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className={ui.heading}>配信中</h1>
      {channels.length === 0 && <p className="text-muted">いま配信している人はいません</p>}
      {split.followed.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-bold">フォロー中</h2>
          <LiveGrid channels={split.followed} />
        </section>
      )}
      {split.others.length > 0 && <LiveGrid channels={split.others} />}
    </main>
  );
}
