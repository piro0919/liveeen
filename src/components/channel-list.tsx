import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ChannelSummary } from '@/lib/channels';
import { channelPath } from '@/lib/handle';
import { liveChannels } from '@/lib/live';
import { ui } from '@/lib/ui';
import { Avatar } from './avatar';

/** 配信者の一覧（検索・フォロー中）。印、名前、ハンドル、タイトル。配信中ならライブの札を付ける */
export async function ChannelList({ channels }: { channels: ChannelSummary[] }) {
  const t = await getTranslations('home');
  const live = new Set((await liveChannels()).map((channel) => channel.channelId));
  return (
    <ul className="flex flex-col gap-1">
      {channels.map((channel) => {
        const name = channel.displayName ?? channel.id;
        return (
          <li key={channel.id}>
            <Link
              href={channelPath(channel)}
              className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-surface"
            >
              <Avatar name={name} src={channel.avatar} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-bold">{name}</span>
                {channel.handle && <span className={`truncate ${ui.note}`}>@{channel.handle}</span>}
                {channel.title && <span className={`truncate ${ui.note}`}>{channel.title}</span>}
              </span>
              {live.has(channel.id) && <span className={ui.liveTag}>{t('live')}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
