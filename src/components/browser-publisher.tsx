'use client';

import { useEffect, useRef, useState } from 'react';
import { browserPublishTokenAction, publishingAction } from '@/app/broadcast/actions';
import { loadImage, type StillImage, stillImageStream } from '@/lib/still-image';
import { captureCamera, captureMicrophone, publishWhip, type WhipSession } from '@/lib/whip';
import { ui } from '@/lib/ui';
import { Comments } from './comments';

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
};

/**
 * ブラウザで配信する。カメラか、画像と声かを選ぶ。画像ならカメラの許可を求めない。
 * 配信中は映像を画面いっぱいに出し、コメントを重ねる（手本は YouTube のアプリの配信）
 */
export function BrowserPublisher({ whipUrl, channelId, relayUrl, guestComments, name }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const liveVideo = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const still = useRef<StillImage | null>(null);
  const session = useRef<WhipSession | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [source, setSource] = useState<Source>('camera');
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }

  async function stop() {
    await session.current?.stop();
    session.current = null;
    release();
    setStatus('idle');
  }

  async function capture(): Promise<MediaStream> {
    if (source === 'camera') return captureCamera();
    const microphone = await captureMicrophone();
    still.current = stillImageStream(image, name);
    return new MediaStream([
      ...still.current.stream.getVideoTracks(),
      ...microphone.getAudioTracks(),
    ]);
  }

  async function start() {
    setStatus('starting');
    setError(null);
    try {
      stream.current = await capture();
      // カメラやマイクがほかのアプリに取られたり、端末に止められたりしたら、配信を終えて知らせる
      for (const track of stream.current.getTracks()) {
        track.addEventListener(
          'ended',
          () => void stop().then(() => setError('カメラかマイクが止まったため、配信を終えました')),
        );
      }
      const token = await browserPublishTokenAction();
      session.current = await publishWhip(whipUrl, token, stream.current, {
        onEnded: () => void stop().then(() => setError('配信が切れました')),
        stillPublishing: publishingAction,
      });
      setStatus('live');
    } catch (e) {
      await stop();
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function chooseImage(file: File | undefined) {
    if (!file) return;
    try {
      setImage(await loadImage(file));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // 画面を離れたら配信を止め、カメラとマイクを放す
  useEffect(
    () => () => {
      void session.current?.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      still.current?.stop();
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
          <span className={ui.liveTag}>ライブ</span>
          <button type="button" className={ui.overlayButton} onClick={() => void stop()}>
            配信を終える
          </button>
        </div>
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
        <legend className="sr-only">映すもの</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="source"
            className={ui.check}
            checked={source === 'camera'}
            onChange={() => setSource('camera')}
          />
          カメラ
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="source"
            className={ui.check}
            checked={source === 'image'}
            onChange={() => setSource('image')}
          />
          画像と声（カメラを使わない）
        </label>
      </fieldset>
      {source === 'image' && (
        <div className="flex flex-col gap-1">
          <label className={ui.tonalButton}>
            画像を選ぶ
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void chooseImage(event.target.files?.[0])}
            />
          </label>
          <p className={ui.note}>選ばなければ、名前を映します</p>
        </div>
      )}
      <div className={ui.videoFrame}>
        <video ref={video} autoPlay muted playsInline className="size-full object-contain" />
        {source === 'camera' && <p className={ui.videoMessage}>始めるとカメラが映ります</p>}
      </div>
      <p className={ui.note}>
        配信中にほかのアプリへ移ると、映像や音が止まることがあります。配信中はこの画面のままにしてください
      </p>
      <button
        type="button"
        className={ui.primaryButton}
        disabled={status === 'starting'}
        onClick={() => void start()}
      >
        配信を始める
      </button>
      {error && <p className={ui.error}>{error}</p>}
    </div>
  );
}
