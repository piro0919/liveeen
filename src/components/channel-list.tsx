import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ChannelSummary } from '@/lib/channels';
import { channelPath } from '@/lib/handle';
import { liveChannels } from '@/lib/live';
import { liveFirst } from '@/lib/live-paths';
import { thumbnailUrl } from '@/lib/thumbnail';
import { ui } from '@/lib/ui';
import { viewerCounts } from '@/lib/viewers';
import { env } from '@/env';
import { Avatar } from './avatar';
import { LiveTag } from './live-tag';
import { LiveThumbnail } from './live-thumbnail';

type Props = {
  channels: ChannelSummary[];
  /** 配信中の人を上にまとめる（フォロー中）。検索は一致の強い順のままにする */
  groupLive?: boolean;
};

/**
 * 配信者の一覧（検索・フォロー中）。手本は Twitch のスマホの検索：
 * 配信中の人は左に絵、右に名前・タイトル・見ている人の数。配信していない人は印と名前とハンドル
 */
export async function ChannelList({ channels, groupLive = false }: Props) {
  const tViewers = await getTranslations('viewers');
  const live = new Set((await liveChannels()).map((channel) => channel.channelId));
  const viewers =
    live.size > 0
      ? await viewerCounts(env.NEXT_PUBLIC_COMMENT_RELAY_URL)
      : new Map<string, number>();
  const shown = groupLive ? liveFirst(channels, live) : channels;
  return (
    <ul className="flex flex-col gap-1">
      {shown.map((channel) => {
        const name = channel.displayName ?? channel.id;
        const count = viewers.get(channel.id);
        const thumbnail = thumbnailUrl(env.NEXT_PUBLIC_COMMENT_RELAY_URL, channel.id);
        return (
          <li key={channel.id}>
            <Link
              href={channelPath(channel)}
              className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-surface"
            >
              {live.has(channel.id) ? (
                <>
                  <span
                    className={`flex w-40 shrink-0 items-center justify-center ${ui.thumbnail}`}
                  >
                    {/* 住所は1分ごとに変わる。変わったら撮れなかったことを忘れて、もう一度読ませる */}
                    <LiveThumbnail key={thumbnail} name={name} src={thumbnail} />
                    <LiveTag />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-bold">{name}</span>
                    {channel.title && (
                      <span className={`line-clamp-2 wrap-break-word ${ui.note}`}>
                        {channel.title}
                      </span>
                    )}
                    {count !== undefined && (
                      <span className={ui.note}>{tViewers('count', { count })}</span>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <Avatar name={name} src={channel.avatar} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-bold">{name}</span>
                    {channel.handle && (
                      <span className={`truncate ${ui.note}`}>@{channel.handle}</span>
                    )}
                    {channel.title && (
                      <span className={`truncate ${ui.note}`}>{channel.title}</span>
                    )}
                  </span>
                </>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
