/** 中継につなぎ直すまでの最初の間 */
const FIRST_MS = 3000;
/** つなぎ直すまでの間の上限 */
const MAX_MS = 60_000;
/** 全員が同じ瞬間につなぎ直さないよう、間をこの割合だけ散らす */
const SPREAD = 0.25;

/**
 * 中継に届かなかった回数から、次につなぎに行くまでの間を決める。3秒から倍々で1分まで。
 * 中継が止まると開いている全員が札をもらいに来る（Vercel と DB に届く）ので、間を広げる。
 * attempt は 0 から数える
 */
export function relayRetryMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(MAX_MS, FIRST_MS * 2 ** attempt);
  return Math.round(base * (1 - SPREAD + random() * SPREAD * 2));
}
