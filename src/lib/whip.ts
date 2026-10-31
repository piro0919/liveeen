/** 映像の上限（CLAUDE.md：720p まで） */
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 720;
const FRAME_RATE = 30;
/** 映像の送る量の上限（ビット毎秒）。720p の30コマで足りる量 */
const MAX_VIDEO_BITRATE = 2_500_000;
/** 候補の住所を集め終えるのを待つ上限。集め終わらなくても、それまでの分で始める */
const ICE_GATHER_TIMEOUT_MS = 2000;
const CREATED = 201;

/** カメラとマイクを取る。720p を超える大きさでは取らない */
export function captureCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: MAX_WIDTH, max: MAX_WIDTH },
      height: { ideal: MAX_HEIGHT, max: MAX_HEIGHT },
      frameRate: { ideal: FRAME_RATE, max: FRAME_RATE },
    },
    audio: true,
  });
}

/** マイクだけを取る（画像で配信するとき）。カメラの許可は求めない */
export function captureMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

/** H264 の型の並べ方。先にあるものほど先に出す */
const H264_PROFILE_ORDER = [
  // Constrained Baseline。どの端末でも再生できる
  '42e01f',
  // High
  '640034',
];

function h264Rank(codec: RTCRtpCodec): number {
  if (codec.mimeType.toLowerCase() !== 'video/h264') return H264_PROFILE_ORDER.length + 2;
  const fmtp = codec.sdpFmtpLine ?? '';
  // packetization-mode=0 は大きな画面を1つの包みに収められず、使わない
  if (!fmtp.includes('packetization-mode=1')) return H264_PROFILE_ORDER.length + 1;
  const index = H264_PROFILE_ORDER.findIndex((profile) =>
    fmtp.includes(`profile-level-id=${profile}`),
  );
  return index === -1 ? H264_PROFILE_ORDER.length : index;
}

/**
 * 映像は H264 を先に出す。MediaMTX は相手の出した順で選び、Chrome は何もしないと VP8 を出す。
 * VP8 は HLS に載らない（CLAUDE.md）。
 * H264 の中では Constrained Baseline（42e01f）を先にする。Chrome が最初に並べる Baseline（42001f）だと、
 * Mac の Chrome の VideoToolbox が10コマほどで止まった（2026-10-30、手元で確かめた）
 */
function preferH264(transceiver: RTCRtpTransceiver) {
  const codecs = RTCRtpSender.getCapabilities?.('video')?.codecs;
  if (!codecs || !transceiver.setCodecPreferences) return;
  transceiver.setCodecPreferences([...codecs].sort((a, b) => h264Rank(a) - h264Rank(b)));
}

export function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const timer = setTimeout(done, ICE_GATHER_TIMEOUT_MS);
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

export type WhipSession = {
  stop: () => Promise<void>;
  /** 送る音を差し替える（BGM を流し始めた・止めた）。つなぎ直さずに済む */
  replaceAudio: (track: MediaStreamTrack) => Promise<void>;
};

/**
 * 配信のつながりの状態が変わったとき、どうするか。
 * failed は戻らないので終わり。disconnected は回線の揺れでも起きて戻ることがあるので、配信サーバーに聞く。
 * Chrome は切られてから約7秒で disconnected、さらに約10秒で failed になった（2026-10-31、手元で測った）。
 * 聞けば failed を待つより10秒ほど早く気づける
 */
export function afterConnectionChange(state: RTCPeerConnectionState): 'ended' | 'ask' | 'keep' {
  if (state === 'failed') return 'ended';
  if (state === 'disconnected') return 'ask';
  return 'keep';
}

/**
 * WHIP で配信を始める（MediaMTX の `<WebRTC の受け口>/<チャンネルの id>/whip`）。
 * 札（token）は Bearer で渡し、MediaMTX がサイトに確かめる（src/lib/media-auth.ts）。
 * 始めた後に配信サーバーの側から切られたら（運営が止めた、回線が切れたなど）、onEnded を一度だけ呼ぶ
 */
export async function publishWhip(
  url: string,
  token: string,
  stream: MediaStream,
  {
    onEnded,
    stillPublishing,
  }: {
    onEnded: () => void;
    /** 配信サーバーに配信が届いているか。分からなければ null */
    stillPublishing: () => Promise<boolean | null>;
  },
): Promise<WhipSession> {
  const pc = new RTCPeerConnection();
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    onEnded();
  };
  pc.addEventListener('connectionstatechange', () => {
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
  let audioSender: RTCRtpSender | null = null;
  for (const track of stream.getTracks()) {
    const transceiver = pc.addTransceiver(track, {
      direction: 'sendonly',
      sendEncodings: track.kind === 'video' ? [{ maxBitrate: MAX_VIDEO_BITRATE }] : undefined,
    });
    if (track.kind === 'video') preferH264(transceiver);
    else audioSender = transceiver.sender;
  }
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIceGathering(pc);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp', Authorization: `Bearer ${token}` },
      body: pc.localDescription?.sdp,
    });
    if (response.status !== CREATED)
      throw new Error(`配信を始められませんでした（${response.status}）`);
    const location = response.headers.get('Location');
    await pc.setRemoteDescription({ type: 'answer', sdp: await response.text() });
    return {
      stop: async () => {
        // 終わりを伝えてから切る。先に切ると MediaMTX が配信を片付け終えていて、伝える先が 404 になる。
        // 伝わらなくても、つながりが切れれば MediaMTX は配信を閉じる
        if (location) {
          await fetch(new URL(location, url), {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => undefined);
        }
        pc.close();
      },
      replaceAudio: async (track) => {
        await audioSender?.replaceTrack(track);
      },
    };
  } catch (error) {
    pc.close();
    throw error;
  }
}
