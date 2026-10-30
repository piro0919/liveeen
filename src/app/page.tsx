import Link from 'next/link';
import { connection } from 'next/server';
import { followedAmong, listsFollowedOnTop } from '@/lib/follows';
import { type LiveChannel, liveChannels } from '@/lib/live';
import { splitFollowed } from '@/lib/live-paths';
import { currentUserId } from '@/lib/session';

/** 配信の始まった時刻。初版は日本向け（CLAUDE.md）なので日本の時刻で出す */
const startedAtFormat = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tokyo',
});

function LiveList({ channels }: { channels: LiveChannel[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {channels.map((channel) => (
        <li key={channel.channelId}>
          <Link href={`/${channel.channelId}`} className="underline">
            {channel.displayName ?? channel.channelId}
          </Link>{' '}
          <span className="text-sm text-gray-500">
            {startedAtFormat.format(channel.startedAt)} から
          </span>
        </li>
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
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">配信中</h1>
      {channels.length === 0 && <p>いま配信している人はいません</p>}
      {split.followed.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold">フォロー中</h2>
          <LiveList channels={split.followed} />
        </section>
      )}
      {split.others.length > 0 && <LiveList channels={split.others} />}
    </main>
  );
}
