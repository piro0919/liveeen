'use client';

import { useActionState } from 'react';
import { createChannelAction, resetStreamKeyAction, type KeyState } from '@/app/broadcast/actions';
import { BrowserPublisher } from './browser-publisher';

const NO_KEY: KeyState = { key: null };

type Props = {
  channelId: string | null;
  rtmpUrl: string;
  webrtcUrl: string;
};

/**
 * 配信の準備。チャンネルが無ければ18歳以上の申告を受けて作り、あれば OBS に入れる設定とブラウザの配信を出す。
 * 鍵は作ったときと作り直したときにだけ見せる（DB には SHA-256 でしか無い）。
 * 作った直後はページが作り直されてもこの部品は残るので、見せる鍵も残る
 */
export function BroadcastSetup({ channelId, rtmpUrl, webrtcUrl }: Props) {
  const [created, create, creating] = useActionState(createChannelAction, NO_KEY);
  const [reset, resetKey, resetting] = useActionState(resetStreamKeyAction, NO_KEY);
  const key = reset.key ?? created.key;

  if (!channelId) {
    return (
      <form action={create} className="flex flex-col gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="adult" value="yes" required />
          18歳以上です
        </label>
        <button type="submit" className="rounded border px-4 py-2" disabled={creating}>
          チャンネルを作る
        </button>
      </form>
    );
  }

  const whipUrl = `${webrtcUrl}/${channelId}/whip`;
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">ブラウザで配信</h2>
        <BrowserPublisher whipUrl={whipUrl} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">OBS で配信</h2>
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
          <button type="submit" className="rounded border px-4 py-2" disabled={resetting}>
            鍵を作り直す
          </button>
        </form>
      </section>
    </div>
  );
}
