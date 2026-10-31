'use client';

import { useActionState } from 'react';
import { resetStreamKeyAction, type KeyState } from '@/app/broadcast/actions';
import type { LatencyMode } from '@/lib/latency';
import { ui } from '@/lib/ui';

const NO_KEY: KeyState = { key: null };

type Props = {
  channelId: string;
  latencyMode: LatencyMode;
  rtmpUrl: string;
  whipUrl: string;
};

/**
 * OBS に入れる設定（/broadcast/obs）。鍵は作り直したときにだけ見せる（DB には SHA-256 でしか無い）
 */
export function ObsSetup({ channelId, latencyMode, rtmpUrl, whipUrl }: Props) {
  const [reset, resetKey, resetting] = useActionState(resetStreamKeyAction, NO_KEY);
  const key = reset.key;
  return (
    <section className={ui.card}>
      {latencyMode === 'low' && (
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
  );
}
