'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { createChannelAction, resetStreamKeyAction, type KeyState } from '@/app/broadcast/actions';
import type { Channel } from '@/lib/channels';
import { channelPath } from '@/lib/handle';
import { BrowserPublisher } from './browser-publisher';
import { GuestCommentsChoice } from './guest-comments-choice';
import { LatencyChoice } from './latency-choice';
import { ui } from '@/lib/ui';

const NO_KEY: KeyState = { key: null };

type Props = {
  channel: Channel | null;
  rtmpUrl: string;
  webrtcUrl: string;
};

/**
 * 配信の準備。チャンネルが無ければ18歳以上の申告を受けて作り、あれば OBS に入れる設定とブラウザの配信を出す。
 * 鍵は作ったときと作り直したときにだけ見せる（DB には SHA-256 でしか無い）。
 * 作った直後はページが作り直されてもこの部品は残るので、見せる鍵も残る
 */
export function BroadcastSetup({ channel, rtmpUrl, webrtcUrl }: Props) {
  const [created, create, creating] = useActionState(createChannelAction, NO_KEY);
  const [reset, resetKey, resetting] = useActionState(resetStreamKeyAction, NO_KEY);
  const key = reset.key ?? created.key;

  if (!channel) {
    return (
      <form action={create} className={ui.card}>
        <label className="flex items-center gap-2">
          <input type="checkbox" className={ui.check} name="adult" value="yes" required />
          18歳以上です
        </label>
        <button type="submit" className={ui.primaryButton} disabled={creating}>
          チャンネルを作る
        </button>
      </form>
    );
  }

  const channelId = channel.id;
  const whipUrl = `${webrtcUrl}/${channelId}/whip`;
  return (
    <div className="flex flex-col gap-4">
      <div className={ui.card}>
        <p>
          配信の住所：
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
      <section className={ui.card}>
        <h2 className={ui.subheading}>ブラウザで配信</h2>
        <BrowserPublisher whipUrl={whipUrl} />
      </section>
      <section className={ui.card}>
        <h2 className={ui.subheading}>OBS で配信</h2>
        {channel.latencyMode === 'low' && (
          // RTMP の AAC は WebRTC に載らず、B フレーム入りの H264 は MediaMTX が WebRTC に出さない。
          // OBS の WHIP は Opus で送り、B フレームを 0 にする（obs-studio の plugins/obs-webrtc/whip-service.cpp）
          <p>
            低遅延では、OBS 30 以降の WHIP で配信してください。RTMP
            では見ている人に音が届かず、映像の設定によっては映像も届きません。
          </p>
        )}
        <dl className="flex flex-col gap-1">
          <dt>RTMP のサーバー</dt>
          <dd className="mb-2 font-mono break-all">{rtmpUrl}</dd>
          <dt>RTMP のストリームキー</dt>
          <dd className="mb-2 font-mono break-all">
            {key ? `${channelId}?key=${key}` : `${channelId}?key=（鍵）`}
          </dd>
          <dt>WHIP のサーバー</dt>
          <dd className="mb-2 font-mono break-all">{whipUrl}</dd>
          <dt>WHIP の Bearer トークン</dt>
          <dd className="mb-2 font-mono break-all">{key ?? '（鍵）'}</dd>
        </dl>
        <p>鍵は作ったときにだけ表示します。分からなくなったら作り直してください。</p>
        <form action={resetKey}>
          <button type="submit" className={ui.primaryButton} disabled={resetting}>
            鍵を作り直す
          </button>
        </form>
      </section>
    </div>
  );
}
