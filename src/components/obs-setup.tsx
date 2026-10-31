'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { resetStreamKeyAction, type KeyState } from '@/app/broadcast/actions';
import type { LatencyMode } from '@/lib/latency';
import { guarded } from '@/lib/safe-action';
import { CopyButton } from './copy-button';
import { ui } from '@/lib/ui';

const NO_KEY: KeyState = { key: null };

type Props = {
  channelId: string;
  latencyMode: LatencyMode;
  rtmpUrl: string;
  whipUrl: string;
};

/** OBS に写す値。写し間違えやすいので、コピーのボタンを添える */
function Value({ value }: { value: string }) {
  return (
    <dd className="mb-2 flex items-start justify-between gap-3">
      <span className="min-w-0 font-mono break-all">{value}</span>
      <CopyButton value={value} />
    </dd>
  );
}

/**
 * OBS に入れる設定（/broadcast/obs）。鍵は作り直したときにだけ見せる（DB には SHA-256 でしか無い）
 */
export function ObsSetup({ channelId, latencyMode, rtmpUrl, whipUrl }: Props) {
  const t = useTranslations('obs');
  const [reset, resetKey, resetting] = useActionState(guarded(resetStreamKeyAction), NO_KEY);
  const key = reset.key;
  return (
    <section className={ui.card}>
      {latencyMode === 'low' && (
        // RTMP の AAC は WebRTC に載らず、B フレーム入りの H264 は MediaMTX が WebRTC に出さない。
        // OBS の WHIP は Opus で送り、B フレームを 0 にする（obs-studio の plugins/obs-webrtc/whip-service.cpp）
        <p>{t('lowLatencyNote')}</p>
      )}
      <dl className="flex flex-col gap-1">
        <dt>{t('rtmpServer')}</dt>
        <Value value={rtmpUrl} />
        <dt>{t('rtmpKey')}</dt>
        {key ? (
          <Value value={`${channelId}?key=${key}`} />
        ) : (
          <dd className="mb-2 font-mono break-all">{`${channelId}?key=${t('keyPlaceholder')}`}</dd>
        )}
        <dt>{t('whipServer')}</dt>
        <Value value={whipUrl} />
        <dt>{t('whipToken')}</dt>
        {key ? (
          <Value value={key} />
        ) : (
          <dd className="mb-2 font-mono break-all">{t('keyPlaceholder')}</dd>
        )}
      </dl>
      <p>{t('keyNote')}</p>
      <form action={resetKey}>
        <button type="submit" className={ui.primaryButton} disabled={resetting}>
          {t('resetKey')}
        </button>
      </form>
    </section>
  );
}
