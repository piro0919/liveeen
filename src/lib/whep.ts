import { ScreenError } from './screen-error';
import { afterConnectionChange, waitForIceGathering } from './whip';

const CREATED = 201;

export type WhepSession = { stop: () => void };

/**
 * WHEP で低遅延の視聴を始める（MediaMTX の `<WebRTC の受け口>/<チャンネルの id>/whep`）。
 * 見るのにログインは要らないので、札は渡さない。配信していなければ MediaMTX は 404 を返し、ここで投げる。
 * つながりが切れたら onEnded を一度だけ呼ぶ。つながりが揺れたら配信サーバーに聞き、配信が終わっていれば早めに呼ぶ
 * （src/lib/whip.ts の afterConnectionChange）
 */
export async function playWhep(
  url: string,
  {
    onStream,
    onEnded,
    stillPublishing,
  }: {
    onStream: (stream: MediaStream) => void;
    onEnded: () => void;
    /** 配信サーバーに配信が届いているか。分からなければ null */
    stillPublishing: () => Promise<boolean | null>;
  },
): Promise<WhepSession> {
  const pc = new RTCPeerConnection();
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    onEnded();
  };
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });
  // 映像と音声は別々に届く。1つの入れ物に集めて渡す（届くたびに入れ物を替えると、先に届いた方が消える）
  const stream = new MediaStream();
  pc.addEventListener('track', (event) => {
    stream.addTrack(event.track);
    onStream(stream);
  });
  pc.addEventListener('connectionstatechange', () => {
    // 自分で閉じたとき（stop）は、もう見ていないので呼ばない
    if (ended || pc.signalingState === 'closed') return;
    const next = afterConnectionChange(pc.connectionState);
    if (next === 'ended') end();
    if (next === 'ask') {
      void stillPublishing()
        .then((live) => {
          if (live === false) end();
        })
        .catch(() => undefined);
    }
  });
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIceGathering(pc);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: pc.localDescription?.sdp,
    });
    if (response.status !== CREATED)
      throw new ScreenError('whepFailed', { status: response.status });
    const location = response.headers.get('Location');
    await pc.setRemoteDescription({ type: 'answer', sdp: await response.text() });
    return {
      stop: () => {
        // 終わりを伝えてから切る（src/lib/whip.ts と同じ）
        if (location)
          void fetch(new URL(location, url), { method: 'DELETE' }).catch(() => undefined);
        pc.close();
      },
    };
  } catch (error) {
    pc.close();
    throw error;
  }
}
