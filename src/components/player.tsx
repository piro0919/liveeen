'use client';

import Hls from 'hls.js';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LatencyMode } from '@/lib/latency';
import { channelPublishingAction, viewingCapAction } from '@/app/[channelId]/actions';
import { ScreenError } from '@/lib/screen-error';
import { timeAgo } from '@/lib/time-ago';
import { ui } from '@/lib/ui';
import { whenVisible } from '@/lib/when-visible';
import { playWhep } from '@/lib/whep';
import { setPlaying } from './viewer-count';

/** 配信していないとき、もう一度つなぎに行くまでの間 */
const RETRY_MS = 5000;
/**
 * 映っていた配信が切れてからこの間は、タブが裏でもつなぎ直す。音だけ聞いている人を、一度の切断で置いていかない。
 * 過ぎたら、裏のタブは前に戻るまで聞きに行かない
 */
const HIDDEN_RETRY_MS = 120_000;
/** 配信サーバーが視聴を断ったときの答え（src/app/api/media/auth/route.ts） */
const REFUSED = 401;
/** Safari の再生が失敗したとき、この回数に1回だけ断られたのかを聞く（約30秒に1回） */
const NATIVE_REFUSAL_CHECK_EVERY = 6;

/**
 * つなぎ直した映像を流す。音を出している人の自動再生をブラウザが断ったら、音を消して流す。
 * 流れないと iPhone では「配信していません」のまま止まるため。断り以外の失敗（つなぎの取り替えなど）では音を消さない
 */
function playOrMute(element: HTMLVideoElement) {
  if (element.muted) return;
  element.play().catch((error: unknown) => {
    if (!(error instanceof Error) || error.name !== 'NotAllowedError') return;
    element.muted = true;
    void element.play().catch(() => undefined);
  });
}

type Props = {
  channelId: string;
  latencyMode: LatencyMode;
  hlsUrl: string;
  webrtcUrl: string;
  /** 前回の配信が始まった時刻（ミリ秒）。配信したことがなければ null */
  lastLiveAt: number | null;
};

/**
 * 配信を見る。遅延の選び方は配信者が決める（CLAUDE.md）。low は WebRTC（WHEP）、hls は HLS。
 * 配信していなければ、少し待ってつなぎ直す
 */
export function Player({ channelId, latencyMode, hlsUrl, webrtcUrl, lastLiveAt }: Props) {
  const t = useTranslations('player');
  const tWatch = useTranslations('watch');
  const video = useRef<HTMLVideoElement>(null);
  // 開いた直後は、つなぎに行っている間に「配信していません」を出さない
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline' | 'capped'>('connecting');

  // 見ている人の数は、映像が流れているときだけ出す（src/components/viewer-count.tsx）
  useEffect(() => setPlaying(channelId, status === 'live'), [channelId, status]);

  // 音を出すかは見る人が決める。自動で再生するために、始めは音を消しておく
  const [muted, setMuted] = useState(true);
  const [lastSeenAt, setLastSeenAt] = useState(lastLiveAt);

  function unmute() {
    const element = video.current;
    if (!element) return;
    element.muted = false;
    void element.play().catch(() => undefined);
  }

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let cleanup = () => {};
    let cancelWaiting = () => {};
    // Safari の再生が続けて失敗した回数
    let nativeFailures = 0;
    // いまのつなぎで映ったか
    let played = false;
    // この時刻までは、タブが裏でもつなぎ直す
    let retryUntil = 0;

    const markLive = () => {
      played = true;
      setStatus('live');
    };

    const disconnect = () => {
      cleanup();
      cleanup = () => {};
    };

    const scheduleRetry = () => {
      disconnect();
      setStatus('offline');
      if (cancelled) return;
      if (played) {
        retryUntil = Date.now() + HIDDEN_RETRY_MS;
        // 開いている間に配信が終わった。読み込んだときの時刻は、この配信より前のもの
        setLastSeenAt(Date.now());
      }
      played = false;
      retry = setTimeout(() => {
        if (Date.now() < retryUntil) connect();
        else cancelWaiting = whenVisible(connect);
      }, RETRY_MS);
    };

    /**
     * 配信サーバーに断られた（401）。断るのは上限に届いたときだが、サイトが答えられないときも同じ 401 になるので、
     * サイトに聞いて上限のときだけ理由を出して止める。それ以外は「配信していない」と同じくつなぎ直す
     */
    const afterRefusal = () => {
      disconnect();
      void viewingCapAction()
        .catch(() => false)
        .then((capped) => {
          if (cancelled) return;
          if (capped) setStatus('capped');
          else scheduleRetry();
        });
    };

    function connectHls(el: HTMLVideoElement) {
      const src = `${hlsUrl}/${channelId}/index.m3u8`;
      // Safari と iPhone は HLS をそのまま再生できる
      if (!Hls.isSupported()) {
        el.src = src;
        playOrMute(el);
        // video の失敗では答えの番号が分からないので、聞き直す。毎回だと配信していない間の要求が倍になるので、ときどき
        const onError = () => {
          const ask = nativeFailures % NATIVE_REFUSAL_CHECK_EVERY === 0;
          nativeFailures += 1;
          if (!ask) {
            scheduleRetry();
            return;
          }
          void fetch(src)
            .then((response) => response.status === REFUSED)
            .catch(() => false)
            .then((refused) => (refused ? afterRefusal() : scheduleRetry()));
        };
        const onPlaying = () => markLive();
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
      hls.on(Hls.Events.MANIFEST_PARSED, markLive);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.response?.code === REFUSED) afterRefusal();
        else scheduleRetry();
      });
      hls.loadSource(src);
      hls.attachMedia(el);
      playOrMute(el);
      cleanup = () => hls.destroy();
    }

    async function connectWebrtc(el: HTMLVideoElement) {
      try {
        const session = await playWhep(`${webrtcUrl}/${channelId}/whep`, {
          onStream: (stream) => {
            // 捨てたつなぎの映像は入れない。後から届くと、いまのつなぎの映像を上書きし、閉じたまま止まる
            if (cancelled) return;
            el.srcObject = stream;
            playOrMute(el);
            markLive();
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
      } catch (error) {
        if (error instanceof ScreenError && error.values?.status === REFUSED) afterRefusal();
        else scheduleRetry();
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
      cancelWaiting();
      cleanup();
    };
  }, [channelId, latencyMode, hlsUrl, webrtcUrl]);

  return (
    <div className={ui.watchFrame}>
      {/* 配信していないあいだは映像を隠す。ブラウザの読み込み中の輪が、知らせの文字と重なるため */}
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        controls
        className={`size-full ${status === 'offline' || status === 'capped' ? 'invisible' : ''}`}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
      />
      {status === 'offline' && (
        <PlayerMessage>
          {t('offline')}
          {/* 手本は Twitch の配信していないチャンネルの「前回の配信：先月」 */}
          {lastSeenAt !== null && (
            <span className="text-sm">{t('lastLive', { when: timeAgo(lastSeenAt) })}</span>
          )}
        </PlayerMessage>
      )}
      {status === 'capped' && <PlayerMessage>{tWatch('capReached')}</PlayerMessage>}
      {status === 'live' && muted && (
        <button
          type="button"
          className={`absolute top-3 left-3 ${ui.overlayButton}`}
          onClick={unmute}
        >
          {t('unmute')}
        </button>
      )}
    </div>
  );
}

/** 映像の枠の真ん中に出す知らせ（配信していない・上限に届いた） */
export function PlayerMessage({ children }: { children: ReactNode }) {
  return <p className={ui.videoMessage}>{children}</p>;
}
