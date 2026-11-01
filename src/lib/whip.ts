import { captureError, type CaptureKind } from './capture-error';
import { ScreenError } from './screen-error';

/** 映像の上限（CLAUDE.md：720p まで） */
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 720;
const FRAME_RATE = 30;
/** 映像の送る量の上限（ビット毎秒）。720p の30コマで足りる量 */
const MAX_VIDEO_BITRATE = 2_500_000;
/** 候補の住所を集め終えるのを待つ上限。集め終わらなくても、それまでの分で始める */
const ICE_GATHER_TIMEOUT_MS = 2000;
const CREATED = 201;
/** 配信を始める求めの答えを待つ上限 */
const WHIP_TIMEOUT_MS = 10_000;
/** つながってから、配信サーバーに自分のつなぎの id を聞くまでの間。つながった直後は、まだ配信として載っていない */
const OWN_PUBLISHER_WAIT_MS = 5000;

/** 720p を超える大きさでは取らない。choice はどのカメラか */
function cameraVideo(choice?: MediaTrackConstraints): MediaTrackConstraints {
  return {
    width: { ideal: MAX_WIDTH, max: MAX_WIDTH },
    height: { ideal: MAX_HEIGHT, max: MAX_HEIGHT },
    frameRate: { ideal: FRAME_RATE, max: FRAME_RATE },
    ...choice,
  };
}

/** 取れなければ、画面に出せる理由にして投げる。https でない画面やアプリの中のブラウザには mediaDevices が無い */
async function capture(constraints: MediaStreamConstraints, kind: CaptureKind) {
  if (!('mediaDevices' in navigator)) throw new ScreenError('captureUnsupported');
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    throw captureError(error, kind);
  }
}

/** カメラとマイクを取る */
export function captureCamera(choice?: MediaTrackConstraints): Promise<MediaStream> {
  return capture({ video: cameraVideo(choice), audio: true }, 'camera');
}

/** カメラだけを取る（切り替えるとき）。マイクは取り直さない */
export function captureCameraVideo(choice: MediaTrackConstraints): Promise<MediaStream> {
  return capture({ video: cameraVideo(choice) }, 'camera');
}

/** マイクだけを取る（画像で配信するとき）。カメラの許可は求めない */
export function captureMicrophone(): Promise<MediaStream> {
  return capture({ audio: true }, 'mic');
}

/** マイクの音を無音にする、または戻す。映像には触れない */
export function setVoiceMuted(stream: Pick<MediaStream, 'getAudioTracks'>, muted: boolean) {
  for (const track of stream.getAudioTracks()) track.enabled = !muted;
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
  /** 送る映像を差し替える（カメラを切り替えた）。つなぎ直さずに済む */
  replaceVideo: (track: MediaStreamTrack) => Promise<void>;
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
 * 配信サーバーの答えから、この配信が終わったと分かるか。
 * 届いていない（運営が止めた、など）か、別のつなぎが届けている（同じチャンネルへ OBS やほかの端末から配信した）とき。
 * 別のつなぎに取られたのにつなぎ直すと、互いに切り合い、見る人の映像が途切れ続ける
 */
export function publishEnded(current: string | false | null, own: string | null): boolean {
  if (current === false) return true;
  return current !== null && own !== null && current !== own;
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
    onConnected,
    currentPublisher,
  }: {
    /**
     * closed は、配信サーバーに聞けて、配信が届いていないと答えた（運営が止めた、など）。
     * lost は、つながりが切れた（回線かもしれないので、つなぎ直せる）
     */
    onEnded: (reason: 'closed' | 'lost') => void;
    /** つながった。つなぎ直しが効いたことを知らせる */
    onConnected?: () => void;
    /** 配信を届けているつなぎの id。届いていなければ false、分からなければ null */
    currentPublisher: () => Promise<string | false | null>;
  },
): Promise<WhipSession> {
  const pc = new RTCPeerConnection();
  let ended = false;
  // 自分のつなぎの id。別のつなぎに取られたかを見分けるために覚える
  let own: string | null = null;
  let ownTimer: ReturnType<typeof setTimeout> | undefined;
  const end = (reason: 'closed' | 'lost') => {
    if (ended) return;
    ended = true;
    clearTimeout(ownTimer);
    onEnded(reason);
  };
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'connected') {
      onConnected?.();
      clearTimeout(ownTimer);
      ownTimer = setTimeout(() => {
        void currentPublisher()
          .then((current) => {
            if (typeof current === 'string') own = current;
          })
          .catch(() => undefined);
      }, OWN_PUBLISHER_WAIT_MS);
    }
    const next = afterConnectionChange(pc.connectionState);
    if (next === 'ended') end('lost');
    if (next === 'ask') {
      void currentPublisher()
        .then((current) => {
          if (publishEnded(current, own)) end('closed');
        })
        .catch(() => undefined);
    }
  });
  let audioSender: RTCRtpSender | null = null;
  let videoSender: RTCRtpSender | null = null;
  for (const track of stream.getTracks()) {
    const transceiver = pc.addTransceiver(track, {
      direction: 'sendonly',
      sendEncodings: track.kind === 'video' ? [{ maxBitrate: MAX_VIDEO_BITRATE }] : undefined,
    });
    if (track.kind === 'video') {
      preferH264(transceiver);
      videoSender = transceiver.sender;
    } else audioSender = transceiver.sender;
  }
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIceGathering(pc);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp', Authorization: `Bearer ${token}` },
      body: pc.localDescription?.sdp,
      // 回線が切れていると答えが返らないことがある。つなぎ直しを止めないよう、待ち続けない
      signal: AbortSignal.timeout(WHIP_TIMEOUT_MS),
    });
    if (response.status !== CREATED)
      throw new ScreenError('whipFailed', { status: response.status });
    const location = response.headers.get('Location');
    await pc.setRemoteDescription({ type: 'answer', sdp: await response.text() });
    return {
      stop: async () => {
        // 自分で止めたつなぎの知らせは、もう受けない。つなぎ直した後の配信を終わらせないため
        ended = true;
        clearTimeout(ownTimer);
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
      replaceVideo: async (track) => {
        await videoSender?.replaceTrack(track);
      },
    };
  } catch (error) {
    ended = true;
    clearTimeout(ownTimer);
    pc.close();
    throw error;
  }
}
