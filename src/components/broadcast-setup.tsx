'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { createChannelAction, type KeyState } from '@/app/broadcast/actions';
import type { Channel } from '@/lib/channels';
import { channelPath } from '@/lib/handle';
import { BrowserPublisher } from './browser-publisher';
import { GuestCommentsChoice } from './guest-comments-choice';
import { LatencyChoice } from './latency-choice';
import { StreamTitleForm } from './stream-title-form';
import { ui } from '@/lib/ui';

const NO_KEY: KeyState = { key: null };

type Props = {
  channel: Channel | null;
  webrtcUrl: string;
  relayUrl: string;
  bgmUrl?: string;
};

/**
 * 配信の準備。チャンネルが無ければ18歳以上の申告を受けて作る。
 * あれば、スマホで使う人が多いので、ブラウザの配信をいちばん上に置き、その下に設定を並べる。
 * OBS に入れる設定は使う人が限られるので、別のページ（/broadcast/obs）に分ける
 */
export function BroadcastSetup({ channel, webrtcUrl, relayUrl, bgmUrl }: Props) {
  const t = useTranslations('broadcast.setup');
  const [, create, creating] = useActionState(createChannelAction, NO_KEY);

  if (!channel) {
    return (
      <form action={create} className={ui.card}>
        <label className="flex items-center gap-2">
          <input type="checkbox" className={ui.check} name="adult" value="yes" required />
          {t('adult')}
        </label>
        <button type="submit" className={ui.primaryButton} disabled={creating}>
          {t('createChannel')}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* タイトルは配信を始める前に付けるので、配信の上に置く */}
      <div className={ui.card}>
        <StreamTitleForm title={channel.title} />
      </div>
      <section className={ui.card}>
        <BrowserPublisher
          whipUrl={`${webrtcUrl}/${channel.id}/whip`}
          channelId={channel.id}
          relayUrl={relayUrl}
          guestComments={channel.guestComments}
          name={channel.displayName ?? channel.id}
          bgmUrl={bgmUrl}
        />
      </section>
      <div className={ui.card}>
        <p>
          {t('address')}
          <Link href={channelPath(channel)} className={ui.link}>
            {channelPath(channel)}
          </Link>
        </p>
      </div>
      <div className={ui.card}>
        <LatencyChoice mode={channel.latencyMode} />
      </div>
      <div className={ui.card}>
        <GuestCommentsChoice allowed={channel.guestComments} />
      </div>
      <div className={ui.card}>
        <p>
          {t.rich('obsNote', {
            link: (chunks) => (
              <Link href="/broadcast/obs" className={ui.link}>
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </div>
  );
}
