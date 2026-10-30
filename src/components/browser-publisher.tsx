'use client';

import { useEffect, useRef, useState } from 'react';
import { browserPublishTokenAction, publishingAction } from '@/app/broadcast/actions';
import { captureCamera, publishWhip, type WhipSession } from '@/lib/whip';

type Status = 'idle' | 'starting' | 'live' | 'error';

/** ブラウザのカメラとマイクで配信する */
export function BrowserPublisher({ whipUrl }: { whipUrl: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const session = useRef<WhipSession | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function stop() {
    await session.current?.stop();
    session.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setStatus('idle');
  }

  async function start() {
    setStatus('starting');
    setError(null);
    try {
      stream.current = await captureCamera();
      if (video.current) video.current.srcObject = stream.current;
      const token = await browserPublishTokenAction();
      session.current = await publishWhip(whipUrl, token, stream.current, {
        onEnded: () => void stop().then(() => setError('配信が切れました')),
        stillPublishing: publishingAction,
      });
      setStatus('live');
    } catch (e) {
      await stop();
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  // 画面を離れたら配信を止め、カメラとマイクを放す
  useEffect(
    () => () => {
      void session.current?.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  return (
    <div className="flex flex-col gap-2">
      <video ref={video} autoPlay muted playsInline className="aspect-video w-full bg-black" />
      {status === 'live' ? (
        <button type="button" className="rounded border px-4 py-2" onClick={() => void stop()}>
          配信を終える
        </button>
      ) : (
        <button
          type="button"
          className="rounded border px-4 py-2"
          disabled={status === 'starting'}
          onClick={() => void start()}
        >
          ブラウザで配信する
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
