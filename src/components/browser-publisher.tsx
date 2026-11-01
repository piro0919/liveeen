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
import { cameraAttempts, firstCamera, knownCameraCount, listDevices } from '@/lib/camera';
import { formatElapsed } from '@/lib/elapsed';
import { watchMicLevel } from '@/lib/mic-level';
import { RECONNECT_LIMIT_MS, RECONNECT_WAIT_MS, refusedForGood, retryUntil } from '@/lib/reconnect';
import { loadImage, type StillImage, stillImageStream } from '@/lib/still-image';
import { ScreenError, useScreenErrorText } from '@/lib/screen-error';
import type { CommentSettings } from '@/lib/comment-settings';
import type { LatencyMode } from '@/lib/latency';
import { SHAPE_SETTLE_MS, shapeChanged, type VideoSize } from '@/lib/video-shape';
import {
  captureCamera,
  captureCameraVideo,
  captureMicrophone,
  publishWhip,
  setVoiceMuted,
  type WhipSession,
} from '@/lib/whip';
import { ui } from '@/lib/ui';
import { useWakeLock } from '@/lib/use-wake-lock';
import { BgmPicker } from './bgm-picker';
import { CommentRulesForm } from './comment-rules-form';
import { Comments } from './comments';
import { StreamTitleForm } from './stream-title-form';
import { ViewerCount } from './viewer-count';

type Status = 'idle' | 'starting' | 'live' | 'practice';
type Output = { muted: boolean; hidden: boolean };
const OUTPUT_ON: Output = { muted: false, hidden: false };

/** 配信か練習が始まってからの時間。1秒ごとに書き直す */
function LiveClock({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className={`text-sm tabular-nums ${ui.overlayComments}`}>
      {formatElapsed(now - startedAt)}
    </span>
  );
}

/** 映っている映像の大きさ。まだ分からなければ null */
function sizeOf(element: HTMLVideoElement | null): VideoSize | null {
  if (!element?.videoWidth || !element.videoHeight) return null;
  return { width: element.videoWidth, height: element.videoHeight };
}

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
  latencyMode: LatencyMode;
  /** 配信中の画面から変えられるコメントの決まり */
  commentSettings: CommentSettings;
  /** 配信中の画面から変えられるタイトル */
  title: string | null;
  /** つなぐ前にすること（入れたままのタイトルの保存）。投げたら配信を始めない */
  beforeStart: () => Promise<void>;
};

/** 配信中の画面で開いている欄。重なると下のコメントが隠れるので、1つだけ開く */
type LivePanel = 'bgm' | 'rules' | 'title' | null;

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
  latencyMode,
  commentSettings,
  title,
  beforeStart,
}: Props) {
  const t = useTranslations('broadcast.publisher');
  const errorText = useScreenErrorText();
  const video = useRef<HTMLVideoElement>(null);
  const liveVideo = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const still = useRef<StillImage | null>(null);
  const session = useRef<WhipSession | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const onAir = status === 'live' || status === 'practice';
  useWakeLock(onAir);
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
  const [panel, setPanel] = useState<LivePanel>(null);
  // 選んだカメラ。配信を終えて次に始めるときも同じカメラを使う
  const cameraChoice = useRef<MediaTrackConstraints | undefined>(undefined);
  // カメラを取りに行った回の番号。取れるのを待つあいだに配信を終えたら、取れた映像を捨てる
  const cameraRun = useRef(0);
  const deviceStopHandled = useRef(false);
  // カメラの台数。許可を得る前は分からない（null）
  const [cameraCount, setCameraCount] = useState<number | null>(null);
  // 始める前にカメラを映しているか
  const [previewing, setPreviewing] = useState(false);
  const [switching, setSwitching] = useState(false);
  // 声を止めているか、映像と音をまとめて隠しているか。切り替えたカメラやつなぎ直しにも効かせるので、画面の値とは別にも持つ
  const [output, setOutput] = useState(OUTPUT_ON);
  const outputRef = useRef(OUTPUT_ON);
  // 配信か練習が始まった時刻
  const [startedAt, setStartedAt] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  // つなぎ直しの回の番号。配信を終えたら、途中のつなぎ直しをやめる
  const reconnectRun = useRef(0);
  // つなぎ直しの期限。つながるまで持ち越し、つながっては切れるのを繰り返しても終わるようにする
  const reconnectDeadline = useRef<number | null>(null);
  const meterFill = useRef<HTMLDivElement>(null);
  // 今のつなぎで配信サーバーへ最初に送った映像の大きさと、向きが落ち着くのを待つタイマー
  const publishedSize = useRef<VideoSize | null>(null);
  const shapeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // カメラの台数を読む。抜き差しされたら読み直す
  useEffect(() => {
    const read = () => {
      void listDevices().then((devices) => setCameraCount(knownCameraCount(devices)));
    };
    read();
    if (!('mediaDevices' in navigator)) return;
    navigator.mediaDevices.addEventListener('devicechange', read);
    return () => navigator.mediaDevices.removeEventListener('devicechange', read);
  }, []);

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
    if (onAir && liveVideo.current) liveVideo.current.srcObject = stream.current;
  }, [onAir]);

  // 練習のあいだは、音が拾えているかを目盛りで見せる（自分の声は鳴らさない）
  useEffect(() => {
    if (status !== 'practice') return;
    const voice = stream.current?.getAudioTracks()[0];
    if (!voice) return;
    return watchMicLevel(voice, (level) => {
      // 初めの幅0は scale-x-0 で、これは transform でなく scale の値なので、同じ scale で上書きする
      if (meterFill.current) meterFill.current.style.scale = `${level} 1`;
    });
  }, [status]);

  function releaseCapture() {
    cameraRun.current += 1;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setPreviewing(false);
    outputRef.current = OUTPUT_ON;
    setOutput(OUTPUT_ON);
  }

  /**
   * 声を止める・映像と音を隠す。隠すと黒い映像と無音になり、BGM も見る人には届かない。
   * ミュートは声だけで、BGM はそのまま流れる
   */
  function changeOutput(next: Output) {
    outputRef.current = next;
    setOutput(next);
    const current = stream.current;
    if (!current) return;
    for (const track of current.getVideoTracks()) track.enabled = !next.hidden;
    setVoiceMuted(current, next.muted || next.hidden);
    // 曲を重ねた音にも、隠しているかを効かせる
    if (session.current) audioToSend();
  }

  function release() {
    releaseCapture();
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
    if (bgmPlaying.current !== null && mixer.current) {
      const mixed = mixer.current.mix(voice);
      mixed.enabled = !outputRef.current.hidden;
      return mixed;
    }
    mixer.current?.unmix();
    return voice;
  }

  /** 配信中なら、送る音を今の曲の有無に合わせる */
  function syncSentAudio() {
    // 始める前にカメラを映しているだけのときは、声を混ぜない
    if (!session.current) return;
    const track = audioToSend();
    if (track) void session.current.replaceAudio(track).catch(() => undefined);
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
    reconnectRun.current += 1;
    reconnectDeadline.current = null;
    clearTimeout(shapeTimer.current);
    setReconnecting(false);
    setPanel(null);
    await current?.stop();
    release();
    setStatus('idle');
  }

  /** いまのカメラとマイクで WHIP につなぐ。始めるときと、つなぎ直すときに使う */
  async function publish(captured: MediaStream, resume: boolean): Promise<WhipSession> {
    // 曲を選んでいれば、初めから曲を重ねた音を送る
    const audio = audioToSend();
    const sent = new MediaStream([...captured.getVideoTracks(), ...(audio ? [audio] : [])]);
    const token = await browserPublishTokenAction(resume).catch(() => {
      throw new ScreenError('publishToken');
    });
    // 始めるときは配信中の画面がまだ無いので、最初に映像の大きさが分かったときに覚える（watchShape）
    publishedSize.current = sizeOf(liveVideo.current);
    return publishWhip(whipUrl, token, sent, {
      onEnded: (reason) => {
        if (reason === 'lost') void reconnect();
        else void stop().then(() => setError(t('errors.disconnected')));
      },
      onConnected: () => {
        reconnectDeadline.current = null;
        setReconnecting(false);
      },
      // サイトに届かなければ、分からないのと同じ
      currentPublisher: () => publishingAction().catch(() => null),
    });
  }

  /** できあがったつなぎを使い始める。つないでいる間に変えたカメラ・曲・隠すを当て直す */
  function adopt(started: WhipSession) {
    session.current = started;
    const camera = stream.current?.getVideoTracks()[0];
    if (camera) void started.replaceVideo(camera).catch(() => undefined);
    syncSentAudio();
  }

  /**
   * つながりが切れたら、期限までつなぎ直す。カメラとマイクは放さず、画面もそのまま。
   * 運営に止められた配信は closed で終わるので、ここには来ない。止められた配信者は 401 で、すぐあきらめる
   */
  async function reconnect() {
    const lost = session.current;
    session.current = null;
    void lost?.stop();
    const run = ++reconnectRun.current;
    setReconnecting(true);
    reconnectDeadline.current ??= Date.now() + RECONNECT_LIMIT_MS;
    const cancelled = () => run !== reconnectRun.current;
    const started = await retryUntil(
      () => {
        const captured = stream.current;
        if (!captured) throw new Error('カメラとマイクを放しました');
        return publish(captured, true);
      },
      {
        deadline: reconnectDeadline.current,
        waitMs: RECONNECT_WAIT_MS,
        cancelled,
        giveUp: refusedForGood,
      },
    );
    if (cancelled()) {
      await started?.stop();
      return;
    }
    if (!started) {
      await stop();
      setError(t('errors.disconnected'));
      return;
    }
    adopt(started);
    // つなぎ直している間にまた向きが変わっていたら、もう映像の大きさの知らせは来ない
    watchShape();
  }

  /**
   * HLS で見る人のために、映像の縦横比が変わって落ち着いたら、つなぎ直す。
   * 変わったままだと見る人の映像が伸びる（src/lib/video-shape.ts）。WebRTC で見る人の映像は伸びない（手元で確かめた）ので、低遅延ではつなぎ直さない
   */
  function watchShape() {
    clearTimeout(shapeTimer.current);
    if (latencyMode !== 'hls' || !session.current) return;
    const size = sizeOf(liveVideo.current);
    if (!size) return;
    publishedSize.current ??= size;
    if (!shapeChanged(publishedSize.current, size)) return;
    shapeTimer.current = setTimeout(() => {
      if (session.current) void reconnect();
    }, SHAPE_SETTLE_MS);
  }

  /** カメラやマイクがほかのアプリに取られたり、端末に止められたりしたら、配信を終えて知らせる。切り替えで自分から止めたときは呼ばれない */
  function endWhenDeviceStops(track: MediaStreamTrack) {
    track.addEventListener('ended', () => {
      // 映像と音の両方が止まっても、終えるのは1度だけ
      if (deviceStopHandled.current) return;
      deviceStopHandled.current = true;
      void stop().then(() => setError(t('errors.deviceStopped')));
    });
  }

  /** いま使っているカメラを覚え、台数を読み直す。許可を得た後なら正しい台数が分かる */
  function noteCamera(track: MediaStreamTrack | undefined) {
    const deviceId = track?.getSettings().deviceId;
    if (deviceId) cameraChoice.current = { deviceId: { ideal: deviceId } };
    void listDevices().then((devices) => setCameraCount(knownCameraCount(devices)));
  }

  /** 始める前に、今のカメラを映す */
  async function showCameraPreview() {
    const run = ++cameraRun.current;
    setSwitching(true);
    setError(null);
    try {
      const captured = await captureCamera(cameraChoice.current);
      if (run !== cameraRun.current) {
        captured.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = captured;
      noteCamera(captured.getVideoTracks()[0]);
      if (video.current) video.current.srcObject = captured;
      setPreviewing(true);
    } catch (e) {
      if (run === cameraRun.current) setError(errorText(e));
    } finally {
      if (run === cameraRun.current) setSwitching(false);
    }
  }

  /**
   * 次のカメラへ移る。先に今のカメラを止めてから次を取る。2台を同時に使えない端末があるため。
   * 次が取れなければ元のカメラへ戻し、それも取れなければ配信を終える
   */
  async function switchCamera() {
    const current = stream.current;
    const old = current?.getVideoTracks()[0];
    if (!current || !old) return;
    const run = ++cameraRun.current;
    setSwitching(true);
    setError(null);
    const { deviceId, facingMode } = old.getSettings();
    const devices = await listDevices();
    old.stop();
    let next = await firstCamera(
      cameraAttempts({ deviceId, facingMode }, devices),
      captureCameraVideo,
    );
    const moved = next !== null;
    next ??= await firstCamera(
      [deviceId ? { deviceId: { exact: deviceId } } : {}],
      captureCameraVideo,
    );
    if (run !== cameraRun.current) {
      next?.stop();
      setSwitching(false);
      return;
    }
    setSwitching(false);
    if (!next) {
      if (status === 'live') {
        deviceStopHandled.current = true;
        await stop();
        setError(t('errors.deviceStopped'));
      } else {
        // 始める前か練習中。配信はしていない
        await stop();
        setError(t('errors.cameraSwitch'));
      }
      return;
    }
    next.enabled = !outputRef.current.hidden;
    const replaced = new MediaStream([next, ...current.getAudioTracks()]);
    stream.current = replaced;
    noteCamera(next);
    const element = liveVideo.current ?? video.current;
    if (element) element.srcObject = replaced;
    if (status !== 'idle') endWhenDeviceStops(next);
    if (session.current) await session.current.replaceVideo(next).catch(() => undefined);
    if (!moved) setError(t('errors.cameraSwitch'));
  }

  function chooseSource(next: Source) {
    setSource(next);
    // 画像に変えたら、映していたカメラとマイクを放す
    if (next === 'image') {
      releaseCapture();
      setSwitching(false);
    }
  }

  async function capture(): Promise<MediaStream> {
    if (source === 'camera') {
      const captured = await captureCamera(cameraChoice.current);
      noteCamera(captured.getVideoTracks()[0]);
      return captured;
    }
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

  /** 映しているカメラがあればそのまま使い、無ければ取る。映している間に止まっていたら取り直す */
  async function prepareCapture(): Promise<MediaStream | null> {
    const preview = stream.current;
    const usable = preview?.getTracks().every((track) => track.readyState === 'live');
    if (preview && !usable) releaseCapture();
    const run = ++cameraRun.current;
    const captured = preview && usable ? preview : await capture();
    // 許可を待つあいだに画面を離れていたら、取れたものを捨てる。止めるボタンのない配信を始めない
    if (run !== cameraRun.current) {
      captured.getTracks().forEach((track) => track.stop());
      still.current?.stop();
      still.current = null;
      return null;
    }
    stream.current = captured;
    deviceStopHandled.current = false;
    captured.getTracks().forEach(endWhenDeviceStops);
    return captured;
  }

  /** 練習する。配信サーバーにはつながず、配信中と同じ画面で映りと音を確かめる */
  async function startPractice() {
    setStatus('starting');
    setError(null);
    setPanel(null);
    try {
      if (!(await prepareCapture())) return;
      setStartedAt(Date.now());
      setStatus('practice');
    } catch (e) {
      await stop();
      setError(errorText(e));
    }
  }

  async function start() {
    setStatus('starting');
    setError(null);
    setPanel(null);
    // カメラを取る前に済ませる。断られても、映しているカメラと流している曲はそのままにする
    const run = cameraRun.current;
    try {
      await beforeStart();
    } catch (e) {
      setStatus('idle');
      setError(errorText(e));
      return;
    }
    // 保存を待つあいだに画面を離れていたら、始めない
    if (run !== cameraRun.current) return;
    try {
      const captured = await prepareCapture();
      if (!captured) return;
      const started = await publish(captured, false);
      // つないでいるあいだにカメラやマイクが止まって終えていたら、つないだ分も切る
      if (stream.current !== captured) {
        await started.stop();
        return;
      }
      adopt(started);
      setStartedAt(Date.now());
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
      reconnectRun.current += 1;
      cameraRun.current += 1;
      clearTimeout(shapeTimer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      still.current?.stop();
      mixer.current?.close();
      mixer.current = null;
    },
    [],
  );

  const manyCameras = source === 'camera' && cameraCount !== null && cameraCount >= 2;

  if (onAir) {
    const live = status === 'live';
    return (
      <div className={ui.liveScreen}>
        <video
          ref={liveVideo}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 size-full object-contain"
          onResize={watchShape}
        />
        {output.hidden && <p className={ui.videoMessage}>{t('hiddenNotice')}</p>}
        <div className="relative flex flex-wrap items-center justify-between gap-2 p-4 pt-safe-top">
          <div className="flex items-center gap-2">
            <span className={live ? ui.liveTag : ui.practiceTag}>
              {t(live ? 'live' : 'practicing')}
            </span>
            <LiveClock startedAt={startedAt} />
            {live && (
              <ViewerCount channelId={channelId} className={`text-sm ${ui.overlayComments}`} />
            )}
          </div>
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={output.muted ? ui.overlayButtonOn : ui.overlayButton}
              aria-pressed={output.muted}
              onClick={() => changeOutput({ ...output, muted: !output.muted })}
            >
              {output.muted ? t('muted') : t('mute')}
            </button>
            {live && (
              <button
                type="button"
                className={output.hidden ? ui.overlayButtonOn : ui.overlayButton}
                aria-pressed={output.hidden}
                aria-label={t('hideLabel')}
                onClick={() => changeOutput({ ...output, hidden: !output.hidden })}
              >
                {output.hidden ? t('hidden') : t('hide')}
              </button>
            )}
            {manyCameras && (
              <button
                type="button"
                className={ui.overlayButton}
                disabled={switching}
                onClick={() => void switchCamera()}
              >
                {t('switchCamera')}
              </button>
            )}
            {bgmUrl && (
              <button
                type="button"
                className={ui.overlayButton}
                aria-expanded={panel === 'bgm'}
                onClick={() => setPanel((open) => (open === 'bgm' ? null : 'bgm'))}
              >
                BGM
              </button>
            )}
            {live && (
              <button
                type="button"
                className={ui.overlayButton}
                aria-expanded={panel === 'title'}
                onClick={() => setPanel((open) => (open === 'title' ? null : 'title'))}
              >
                {t('title')}
              </button>
            )}
            {live && (
              <button
                type="button"
                className={ui.overlayButton}
                aria-expanded={panel === 'rules'}
                onClick={() => setPanel((open) => (open === 'rules' ? null : 'rules'))}
              >
                {t('commentRules')}
              </button>
            )}
            <button type="button" className={ui.overlayButton} onClick={() => void stop()}>
              {t(live ? 'stop' : 'stopPractice')}
            </button>
          </div>
        </div>
        {!live && (
          <div role="img" aria-label={t('micLevel')} className={`relative mx-4 ${ui.meter}`}>
            <div ref={meterFill} className={`${ui.meterFill} scale-x-0`} />
          </div>
        )}
        {reconnecting && (
          <p className={`relative mx-4 text-sm ${ui.overlayComments}`}>{t('reconnecting')}</p>
        )}
        {bgmUrl && panel === 'bgm' && (
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
        {live && panel === 'rules' && (
          <div className={`relative mx-4 mb-4 ${ui.livePanel}`}>
            <CommentRulesForm settings={commentSettings} />
          </div>
        )}
        {live && panel === 'title' && (
          <div className={`relative mx-4 mb-4 ${ui.livePanel}`}>
            <StreamTitleForm title={title} />
          </div>
        )}
        {error && <p className={`relative mx-4 ${ui.error}`}>{error}</p>}
        {/* コメントは下の半分ほどに重ね、上の映像は見えるままにする。
            コメントの管理とタイトルを開いている間は畳み、保存まで届きやすくする（つないだままにするので、外さない） */}
        {live && (
          <div
            className={`relative mt-auto h-live-comments pb-safe-bottom ${panel === 'rules' || panel === 'title' ? 'hidden' : 'flex'}`}
          >
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
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 始めている途中で変えると、取っているカメラやマイクと食い違う */}
      <fieldset className="flex flex-col gap-2" disabled={status === 'starting'}>
        <legend className="sr-only">{t('source')}</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="source"
            className={ui.check}
            checked={source === 'camera'}
            onChange={() => chooseSource('camera')}
          />
          {t('camera')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="source"
            className={ui.check}
            checked={source === 'image'}
            onChange={() => chooseSource('image')}
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
      {/* 広い画面でも、配信を始めるボタンが画面に収まる大きさにする */}
      <div className={`sm:mx-auto sm:max-w-md ${ui.videoFrame}`}>
        <video ref={video} autoPlay muted playsInline className="size-full object-contain" />
        {/* ページを開いただけではカメラを入れない。押したときに許可を求める */}
        {source === 'camera' && !previewing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              className={ui.overlayButton}
              disabled={switching || status === 'starting'}
              onClick={() => void showCameraPreview()}
            >
              {t('showCamera')}
            </button>
          </div>
        )}
      </div>
      {((manyCameras && previewing) || bgmUrl) && (
        <div className="flex flex-wrap gap-2">
          {manyCameras && previewing && (
            <button
              type="button"
              className={ui.tonalButton}
              disabled={switching || status === 'starting'}
              onClick={() => void switchCamera()}
            >
              {t('switchCamera')}
            </button>
          )}
          {bgmUrl && (
            <button
              type="button"
              className={ui.tonalButton}
              aria-expanded={panel === 'bgm'}
              onClick={() => setPanel((open) => (open === 'bgm' ? null : 'bgm'))}
            >
              BGM
            </button>
          )}
        </div>
      )}
      {bgmUrl && panel === 'bgm' && (
        <BgmPicker playing={bgm} volume={bgmVolume} onPick={pickBgm} onVolume={changeBgmVolume} />
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={ui.primaryButton}
          disabled={status === 'starting' || switching}
          onClick={() => void start()}
        >
          {t('start')}
        </button>
        <button
          type="button"
          className={ui.tonalButton}
          disabled={status === 'starting' || switching}
          onClick={() => void startPractice()}
        >
          {t('practice')}
        </button>
      </div>
      {error && <p className={ui.error}>{error}</p>}
      <p className={ui.note}>{t('stayOnScreen')}</p>
    </div>
  );
}
