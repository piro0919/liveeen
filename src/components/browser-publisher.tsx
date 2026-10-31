'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { browserPublishTokenAction, publishingAction } from '@/app/broadcast/actions';
import {
  BGM_TRACKS,
  type BgmMixer,
  bgmTrackUrl,
  createBgmMixer,
  DEFAULT_BGM_VOLUME,
  nextTrackIndex,
} from '@/lib/bgm';
import { loadImage, type StillImage, stillImageStream } from '@/lib/still-image';
import { useScreenErrorText } from '@/lib/screen-error';
import { captureCamera, captureMicrophone, publishWhip, type WhipSession } from '@/lib/whip';
import { ui } from '@/lib/ui';
import { useWakeLock } from '@/lib/use-wake-lock';
import { BgmPicker } from './bgm-picker';
import { Comments } from './comments';
import { ViewerCount } from './viewer-count';

type Status = 'idle' | 'starting' | 'live';
/** 映すもの。カメラか、1枚の画像（声はマイク） */
type Source = 'camera' | 'image';

type Props = {
  whipUrl: string;
  channelId: string;
  relayUrl: string;
  guestComments: boolean;
  /** 配信者の名前。画像を選ばずに画像で配信するとき、映像に出す */
  name: string;
  /** BGM の曲を置いた住所（`…/bgm`）。無ければ BGM を出さない */
  bgmUrl?: string;
};

/**
 * ブラウザで配信する。カメラか、画像と声かを選ぶ。画像ならカメラの許可を求めない。
 * 配信中は映像を画面いっぱいに出し、コメントを重ねる（手本は YouTube のアプリの配信）
 */
export function BrowserPublisher({
  whipUrl,
  channelId,
  relayUrl,
  guestComments,
  name,
  bgmUrl,
}: Props) {
  const t = useTranslations('broadcast.publisher');
  const errorText = useScreenErrorText();
  const video = useRef<HTMLVideoElement>(null);
  const liveVideo = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const still = useRef<StillImage | null>(null);
  const session = useRef<WhipSession | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  useWakeLock(status === 'live');
  const [source, setSource] = useState<Source>('camera');
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mixer = useRef<BgmMixer | null>(null);
  // 曲の終わりに次の曲へ進むとき、いま流れている曲を描き直しを待たずに知るため、画面の値とは別に持つ
  const bgmPlaying = useRef<number | null>(null);
  // 曲を流そうとした回の番号。素早く押し替えたとき、前の回の失敗で今の曲を止めない
  const bgmAttempt = useRef(0);
  const [bgm, setBgm] = useState<number | null>(null);
  const [bgmVolume, setBgmVolume] = useState(DEFAULT_BGM_VOLUME);
  const [bgmOpen, setBgmOpen] = useState(false);

  // 画像で配信するときは、始める前から見る人に映るものを出す（許可は要らない）
  useEffect(() => {
    if (status !== 'idle' || source !== 'image') return;
    const element = video.current;
    const preview = stillImageStream(image, name);
    if (element) element.srcObject = preview.stream;
    return () => {
      preview.stop();
      if (element) element.srcObject = null;
    };
  }, [status, source, image, name]);

  // 配信中の画面は、配信が始まってから描かれる。描かれたら映像をつなぐ
  useEffect(() => {
    if (status === 'live' && liveVideo.current) liveVideo.current.srcObject = stream.current;
  }, [status]);

  function release() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    still.current?.stop();
    still.current = null;
    // 配信を終えたら曲も止める
    mixer.current?.unmix();
    stopBgm();
  }

  /** 混ぜる仕組みは、押した操作の中で作る（iPhone の Safari はそうしないと鳴らない） */
  function ensureMixer(): BgmMixer {
    mixer.current ??= createBgmMixer(() => {
      const current = bgmPlaying.current;
      if (current !== null) playBgm(nextTrackIndex(current));
    });
    return mixer.current;
  }

  /**
   * 送る音。曲を流している間だけ声に曲を重ねた音にし、それ以外はマイクの音をそのまま送る。
   * BGM を使わない人の声を Web Audio に通さないため
   */
  function audioToSend(): MediaStreamTrack | undefined {
    const voice = stream.current?.getAudioTracks()[0];
    if (!voice) return undefined;
    if (bgmPlaying.current !== null && mixer.current) return mixer.current.mix(voice);
    mixer.current?.unmix();
    return voice;
  }

  /** 配信中なら、送る音を今の曲の有無に合わせる */
  function syncSentAudio() {
    const track = audioToSend();
    if (track && session.current) void session.current.replaceAudio(track).catch(() => undefined);
  }

  function playBgm(index: number) {
    const track = BGM_TRACKS[index];
    if (!bgmUrl || !track) return;
    bgmPlaying.current = index;
    const attempt = ++bgmAttempt.current;
    setBgm(index);
    ensureMixer()
      .play(bgmTrackUrl(bgmUrl, track.id))
      .then(() => {
        if (attempt === bgmAttempt.current) setError(null);
      })
      .catch(() => {
        if (attempt !== bgmAttempt.current) return;
        stopBgm();
        setError(t('errors.bgm'));
      });
    syncSentAudio();
  }

  function stopBgm() {
    bgmPlaying.current = null;
    bgmAttempt.current += 1;
    setBgm(null);
    mixer.current?.stop();
    syncSentAudio();
  }

  function pickBgm(index: number) {
    if (bgmPlaying.current === index) stopBgm();
    else playBgm(index);
  }

  function changeBgmVolume(volume: number) {
    setBgmVolume(volume);
    ensureMixer().setVolume(volume);
  }

  async function stop() {
    // 先に手元から外す。止める途中にもう一度呼ばれても、同じつなぎを2度止めない
    const current = session.current;
    session.current = null;
    await current?.stop();
    release();
    setStatus('idle');
  }

  async function capture(): Promise<MediaStream> {
    if (source === 'camera') return captureCamera();
    const microphone = await captureMicrophone();
    try {
      still.current = stillImageStream(image, name);
    } catch (error) {
      // 画像の映像を作れなければ、取ったマイクも放す
      microphone.getTracks().forEach((track) => track.stop());
      throw error;
    }
    return new MediaStream([
      ...still.current.stream.getVideoTracks(),
      ...microphone.getAudioTracks(),
    ]);
  }

  async function start() {
    setStatus('starting');
    setError(null);
    try {
      const captured = await capture();
      stream.current = captured;
      // カメラやマイクがほかのアプリに取られたり、端末に止められたりしたら、配信を終えて知らせる。
      // 映像と音の両方が止まっても、終えるのは1度だけ
      let endedByDevice = false;
      for (const track of captured.getTracks()) {
        track.addEventListener('ended', () => {
          if (endedByDevice) return;
          endedByDevice = true;
          void stop().then(() => setError(t('errors.deviceStopped')));
        });
      }
      // 始める前に曲を選んでいれば、初めから曲を重ねた音を送る
      const audio = audioToSend();
      const sent = new MediaStream([...captured.getVideoTracks(), ...(audio ? [audio] : [])]);
      const token = await browserPublishTokenAction();
      const started = await publishWhip(whipUrl, token, sent, {
        onEnded: () => void stop().then(() => setError(t('errors.disconnected'))),
        stillPublishing: publishingAction,
      });
      // つないでいるあいだにカメラやマイクが止まって終えていたら、つないだ分も切る
      if (stream.current !== captured) {
        await started.stop();
        return;
      }
      session.current = started;
      setStatus('live');
    } catch (e) {
      await stop();
      setError(errorText(e));
    }
  }

  async function chooseImage(file: File | undefined) {
    if (!file) return;
    try {
      setImage(await loadImage(file));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }

  // 画面を離れたら配信を止め、カメラとマイクを放す
  useEffect(
    () => () => {
      void session.current?.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      still.current?.stop();
      mixer.current?.close();
      mixer.current = null;
    },
    [],
  );

  if (status === 'live') {
    return (
      <div className={ui.liveScreen}>
        <video
          ref={liveVideo}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 size-full object-contain"
        />
        <div className="relative flex items-center justify-between p-4 pt-safe-top">
          <div className="flex items-center gap-2">
            <span className={ui.liveTag}>{t('live')}</span>
            <ViewerCount channelId={channelId} className={`text-sm ${ui.overlayComments}`} />
          </div>
          <div className="flex gap-2">
            {bgmUrl && (
              <button
                type="button"
                className={ui.overlayButton}
                aria-expanded={bgmOpen}
                onClick={() => setBgmOpen((open) => !open)}
              >
                BGM
              </button>
            )}
            <button type="button" className={ui.overlayButton} onClick={() => void stop()}>
              {t('stop')}
            </button>
          </div>
        </div>
        {bgmUrl && bgmOpen && (
          <div className={`relative mx-4 flex min-h-0 flex-col ${ui.overlayPanel}`}>
            <BgmPicker
              playing={bgm}
              volume={bgmVolume}
              onPick={pickBgm}
              onVolume={changeBgmVolume}
              overlay
            />
          </div>
        )}
        {error && <p className={`relative mx-4 ${ui.error}`}>{error}</p>}
        {/* コメントは下の半分ほどに重ね、上の映像は見えるままにする */}
        <div className="relative mt-auto flex h-live-comments pb-safe-bottom">
          <Comments
            channelId={channelId}
            relayUrl={relayUrl}
            viewer="ready"
            guestComments={guestComments}
            own
            reportedComments={null}
            overlay
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t('source')}</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="source"
            className={ui.check}
            checked={source === 'camera'}
            onChange={() => setSource('camera')}
          />
          {t('camera')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="source"
            className={ui.check}
            checked={source === 'image'}
            onChange={() => setSource('image')}
          />
          {t('image')}
        </label>
      </fieldset>
      {source === 'image' && (
        <div className="flex flex-col gap-1">
          <label className={ui.tonalButton}>
            {t('pickImage')}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void chooseImage(event.target.files?.[0])}
            />
          </label>
          <p className={ui.note}>{t('imageFallback')}</p>
        </div>
      )}
      <div className={ui.videoFrame}>
        <video ref={video} autoPlay muted playsInline className="size-full object-contain" />
        {source === 'camera' && <p className={ui.videoMessage}>{t('cameraPreview')}</p>}
      </div>
      {bgmUrl && (
        <section className="flex flex-col gap-2">
          <h2 className={ui.subheading}>BGM</h2>
          <BgmPicker playing={bgm} volume={bgmVolume} onPick={pickBgm} onVolume={changeBgmVolume} />
        </section>
      )}
      <p className={ui.note}>{t('stayOnScreen')}</p>
      <button
        type="button"
        className={ui.primaryButton}
        disabled={status === 'starting'}
        onClick={() => void start()}
      >
        {t('start')}
      </button>
      {error && <p className={ui.error}>{error}</p>}
    </div>
  );
}
