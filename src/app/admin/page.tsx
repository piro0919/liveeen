import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { banAction, stopStreamAction, unbanAction } from './actions';
import { ConfirmButton } from '@/components/confirm-button';
import { bannedChannels, isAdmin } from '@/lib/admin';
import { DELIST_THRESHOLD, streamKey } from '@/lib/delist';
import { channelPath } from '@/lib/handle';
import { liveRegisteredChannels } from '@/lib/live';
import { reportersOf } from '@/lib/reports';

export const metadata: Metadata = { title: '管理 | Liveeen' };

/** 日本の時刻で出す（初版は日本向け。CLAUDE.md） */
const timeFormat = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tokyo',
});

/**
 * 管理画面。運営（ADMIN_EMAILS）だけが開ける。ほかの人には、この画面が無いことにする。
 * 配信中のものを通報の多い順に出し、配信を止める・配信者を止めるを置く。止めた配信者は戻せる
 */
export default async function AdminPage() {
  if (!(await isAdmin())) notFound();
  const live = await liveRegisteredChannels();
  const reporters = await reportersOf(live);
  const countOf = (channel: (typeof live)[number]) => reporters.get(streamKey(channel)) ?? 0;
  const byReports = [...live].sort((a, b) => countOf(b) - countOf(a));
  const banned = await bannedChannels();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
      <h1 className="text-xl font-bold">管理</h1>
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">配信中</h2>
        {byReports.length === 0 ? (
          <p>いま配信している人はいません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {byReports.map((channel) => (
              <li key={channel.channelId} className="flex flex-wrap items-center gap-2">
                <Link
                  href={channelPath({ id: channel.channelId, handle: channel.handle })}
                  className="underline"
                >
                  {channel.displayName ?? channel.channelId}
                </Link>
                <span className="text-sm text-gray-500">
                  {timeFormat.format(channel.startedAt)} から ・ 通報 {countOf(channel)}
                  {countOf(channel) >= DELIST_THRESHOLD && '（一覧から外した）'}
                </span>
                <ConfirmButton
                  label="配信を止める"
                  confirm="この配信を止めますか。配信者はつなぎ直せます"
                  action={stopStreamAction.bind(null, channel.channelId)}
                />
                <ConfirmButton
                  label="配信者を止める"
                  confirm="この配信者を止めますか。戻すまで配信できなくなります"
                  action={banAction.bind(null, channel.channelId)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">止めた配信者</h2>
        {banned.length === 0 ? (
          <p>いません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {banned.map((channel) => (
              <li key={channel.id} className="flex flex-wrap items-center gap-2">
                <Link href={channelPath(channel)} className="underline">
                  {channel.displayName ?? channel.id}
                </Link>
                <span className="text-sm text-gray-500">
                  {timeFormat.format(channel.bannedAt)} に止めた
                </span>
                <ConfirmButton
                  label="戻す"
                  confirm="この配信者を戻しますか。また配信できるようになります"
                  action={unbanAction.bind(null, channel.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
