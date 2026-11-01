import type { Comment } from './comment';

/**
 * つなぎ直したときに中継が送ってくる直近のコメントを、画面の一覧へ入れる。中継が覚えているのは直近の分だけで、
 * 丸ごと置き換えると、上へ戻して読んでいた古いコメントが札の取り替えのたびに消える。
 * 直近の分より古いものだけ残す。直近の範囲に無いものは、つないでいない間に消されたものなので戻さない
 */
export function mergeHistory(
  shown: readonly Comment[],
  history: readonly Comment[],
  max: number,
): Comment[] {
  const first = history[0];
  if (!first) return [...history];
  const older = shown.filter((comment) => comment.at < first.at);
  return [...older, ...history].slice(-max);
}
