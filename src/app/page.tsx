import Link from 'next/link';
import { connection } from 'next/server';
import { liveChannels } from '@/lib/live';

/** 配信の始まった時刻。初版は日本向け（CLAUDE.md）なので日本の時刻で出す */
const startedAtFormat = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tokyo',
});

/** トップ。いま配信中の一覧（CLAUDE.md）。開くたびに配信サーバーに聞く */
export default async function Home() {
  await connection();
  const channels = await liveChannels();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">配信中</h1>
      {channels.length === 0 ? (
        <p>いま配信している人はいません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {channels.map((channel) => (
            <li key={channel.channelId}>
              <Link href={`/${channel.channelId}`} className="underline">
                {channel.channelId}
              </Link>{' '}
              <span className="text-sm text-gray-500">
                {startedAtFormat.format(channel.startedAt)} から
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
