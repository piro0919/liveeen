import { waitForIceGathering } from './whip';

const CREATED = 201;

export type WhepSession = { stop: () => void };

/**
 * WHEP で低遅延の視聴を始める（MediaMTX の `<WebRTC の受け口>/<チャンネルの id>/whep`）。
 * 見るのにログインは要らないので、札は渡さない。配信していなければ MediaMTX は 404 を返し、ここで投げる。
 * つながりが切れたら onEnded を呼ぶ
 */
export async function playWhep(
  url: string,
  onStream: (stream: MediaStream) => void,
  onEnded: () => void,
): Promise<WhepSession> {
  const pc = new RTCPeerConnection();
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });
  // 映像と音声は別々に届く。1つの入れ物に集めて渡す（届くたびに入れ物を替えると、先に届いた方が消える）
  const stream = new MediaStream();
  pc.addEventListener('track', (event) => {
    stream.addTrack(event.track);
    onStream(stream);
  });
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') onEnded();
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
      throw new Error(`視聴を始められませんでした（${response.status}）`);
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
