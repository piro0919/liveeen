'use client';

import Hls from 'hls.js';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { LatencyMode } from '@/lib/latency';
import { channelPublishingAction } from '@/app/[channelId]/actions';
import { ui } from '@/lib/ui';
import { playWhep } from '@/lib/whep';

/** 配信していないとき、もう一度つなぎに行くまでの間 */
const RETRY_MS = 5000;

type Props = {
  channelId: string;
  latencyMode: LatencyMode;
  hlsUrl: string;
  webrtcUrl: string;
};

/**
 * 配信を見る。遅延の選び方は配信者が決める（CLAUDE.md）。low は WebRTC（WHEP）、hls は HLS。
 * 配信していなければ、少し待ってつなぎ直す
 */
export function Player({ channelId, latencyMode, hlsUrl, webrtcUrl }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  // 開いた直後は、つなぎに行っている間に「配信していません」を出さない
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let cleanup = () => {};

    const scheduleRetry = () => {
      cleanup();
      setStatus('offline');
      if (!cancelled) retry = setTimeout(connect, RETRY_MS);
    };

    function connectHls(el: HTMLVideoElement) {
      const src = `${hlsUrl}/${channelId}/index.m3u8`;
      // Safari と iPhone は HLS をそのまま再生できる
      if (!Hls.isSupported()) {
        el.src = src;
        const onError = () => scheduleRetry();
        const onPlaying = () => setStatus('live');
        el.addEventListener('error', onError);
        el.addEventListener('playing', onPlaying);
        cleanup = () => {
          el.removeEventListener('error', onError);
          el.removeEventListener('playing', onPlaying);
          el.removeAttribute('src');
          el.load();
        };
        return;
      }
      const hls = new Hls({ lowLatencyMode: true });
      hls.on(Hls.Events.MANIFEST_PARSED, () => setStatus('live'));
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) scheduleRetry();
      });
      hls.loadSource(src);
      hls.attachMedia(el);
      cleanup = () => hls.destroy();
    }

    async function connectWebrtc(el: HTMLVideoElement) {
      try {
        const session = await playWhep(`${webrtcUrl}/${channelId}/whep`, {
          onStream: (stream) => {
            el.srcObject = stream;
            setStatus('live');
          },
          onEnded: scheduleRetry,
          stillPublishing: () => channelPublishingAction(channelId),
        });
        if (cancelled) {
          session.stop();
          return;
        }
        cleanup = () => {
          session.stop();
          el.srcObject = null;
        };
      } catch {
        scheduleRetry();
      }
    }

    function connect() {
      if (cancelled || !element) return;
      if (latencyMode === 'low') void connectWebrtc(element);
      else connectHls(element);
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      cleanup();
    };
  }, [channelId, latencyMode, hlsUrl, webrtcUrl]);

  return (
    <div className={ui.watchFrame}>
      {/* 音を出すかは見る人が決める。自動で再生するために、始めは音を消しておく */}
      {/* 配信していないあいだは映像を隠す。ブラウザの読み込み中の輪が、知らせの文字と重なるため */}
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        controls
        className={`size-full ${status === 'offline' ? 'invisible' : ''}`}
      />
      {status === 'offline' && <PlayerMessage>配信していません</PlayerMessage>}
    </div>
  );
}

/** 映像の枠の真ん中に出す知らせ（配信していない・上限に届いた） */
export function PlayerMessage({ children }: { children: ReactNode }) {
  return <p className={ui.videoMessage}>{children}</p>;
}
