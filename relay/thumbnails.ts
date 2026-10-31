import { spawn } from 'node:child_process';
import { livePathsOrNull } from '../src/lib/live-paths';

/** 縮小画像を撮り直す間隔 */
const CAPTURE_INTERVAL_MS = 60_000;
/** 1枚を撮るのを待つ上限。HLS の最初の区切りが届くまでに数秒かかる */
const CAPTURE_TIMEOUT_MS = 20_000;
/** 配信サーバーの API が答えないときに待つ上限 */
const API_TIMEOUT_MS = 3000;
/** 一度に読む配信の数。MediaMTX の既定は100件で切れる（src/lib/live.ts と同じ） */
const ITEMS_PER_PAGE = 1000;
/** 縮小画像の横幅。トップの札は広い画面でも横 400px ほど */
const THUMBNAIL_WIDTH = 640;

/** 1つの配信から1枚撮る。撮れなければ null。signal が切れたら撮るのをやめる */
export type Capture = (channelId: string, signal: AbortSignal) => Promise<Buffer | null>;

/** ffmpeg で HLS から最初の1枚を JPEG にする */
export function ffmpegCapture(hlsUrl: string): Capture {
  return (channelId, signal) =>
    new Promise((resolve) => {
      const ffmpeg = spawn(
        'ffmpeg',
        [
          ...['-loglevel', 'error', '-i', `${hlsUrl}/${channelId}/index.m3u8`],
          ...['-frames:v', '1', '-vf', `scale=${THUMBNAIL_WIDTH}:-2`],
          ...['-f', 'image2', '-c:v', 'mjpeg', '-q:v', '5', 'pipe:1'],
        ],
        // 中継を止めたとき、撮っている途中の ffmpeg を残さない
        { stdio: ['ignore', 'pipe', 'ignore'], signal, killSignal: 'SIGKILL' },
      );
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => ffmpeg.kill('SIGKILL'), CAPTURE_TIMEOUT_MS);
      ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      ffmpeg.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });
      ffmpeg.on('close', (code) => {
        clearTimeout(timer);
        resolve(code === 0 && chunks.length > 0 ? Buffer.concat(chunks) : null);
      });
    });
}

type Options = {
  /** MediaMTX の API。本番も手元も、中継と同じ機械の 9997 */
  apiUrl: string;
  capture: Capture;
  fetch?: typeof fetch;
  intervalMs?: number;
};

/**
 * 配信の縮小画像（トップの札）。配信サーバー（MediaMTX）は画像を出さないので、
 * 配信中の一覧を一定の間隔で読み、それぞれの HLS から1枚ずつ撮ってメモリに持つ。
 * 終わった配信の画像は次の巡回で捨てる。1台で順に撮るので、配信が増えると1巡が長くなる
 */
export function startThumbnails({
  apiUrl,
  capture,
  fetch: fetchFn = fetch,
  intervalMs = CAPTURE_INTERVAL_MS,
}: Options) {
  const images = new Map<string, Buffer>();
  const stopping = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  async function liveIds(): Promise<string[] | null> {
    const response = await fetchFn(`${apiUrl}/v3/paths/list?itemsPerPage=${ITEMS_PER_PAGE}`, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    }).catch(() => null);
    if (!response?.ok) return null;
    // 形の合わない答えを「配信がない」と読むと、持っている画像を全部捨ててしまう
    const paths = livePathsOrNull(await response.json().catch(() => null));
    return paths?.map((path) => path.channelId) ?? null;
  }

  /** 1巡。配信サーバーが答えなければ、持っている画像はそのまま */
  async function round(): Promise<void> {
    const ids = await liveIds();
    if (!ids) return;
    for (const id of images.keys()) if (!ids.includes(id)) images.delete(id);
    for (const id of ids) {
      if (stopping.signal.aborted) return;
      const image = await capture(id, stopping.signal);
      if (image) images.set(id, image);
    }
  }

  async function loop(): Promise<void> {
    await round();
    if (!stopping.signal.aborted) timer = setTimeout(() => void loop(), intervalMs);
  }
  const first = loop();

  return {
    get: (channelId: string) => images.get(channelId),
    /** 最初の1巡が終わったら解ける（確かめ用） */
    firstRound: first,
    /** 1巡を回す（確かめ用） */
    round,
    stop: () => {
      stopping.abort();
      clearTimeout(timer);
    },
  };
}
