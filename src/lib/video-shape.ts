export type VideoSize = { width: number; height: number };

/**
 * 縦横比が変わったと見る差。回線に合わせて解像度が下がっても比はほぼ同じで、
 * 割り切れない分のずれ（1280×720 から 480×270 など）は数 % に収まる。長さは Claude が決めた
 */
const SHAPE_TOLERANCE = 0.05;

/** スマホを回している途中で何度もつなぎ直さないよう、向きが落ち着くまで待つ長さ。長さは Claude が決めた */
export const SHAPE_SETTLE_MS = 1500;

/**
 * 映像の縦横比が変わったか。
 * MediaMTX の HLS は、つないだ最初の映像の比を配信の終わりまで使い続けるので、
 * 配信中にスマホの向きが変わると、つなぎ直さない限り見る人の映像が伸びる（2026-11-01、手元で確かめた）
 */
export function shapeChanged(published: VideoSize, now: VideoSize): boolean {
  if (published.width <= 0 || published.height <= 0) return false;
  if (now.width <= 0 || now.height <= 0) return false;
  const ratio = now.width / now.height / (published.width / published.height);
  return Math.abs(ratio - 1) > SHAPE_TOLERANCE;
}
