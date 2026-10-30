import type { LivePath } from './live-paths';

/**
 * 1回の配信で、通報した人がこの数に届いたらトップの一覧から外す。
 * 運営は1人で、寝ているあいだはこれだけが守り（CLAUDE.md）。数は Claude が決めた
 */
export const DELIST_THRESHOLD = 3;

/** 配信1回を見分ける鍵。同じチャンネルでも、始まった時刻が違えば別の配信 */
export function streamKey(path: LivePath): string {
  return `${path.channelId}@${path.startedAt.getTime()}`;
}

/** 通報した人が DELIST_THRESHOLD に届いた配信を除く。reporters は streamKey ごとの通報した人の数 */
export function withoutDelisted<T extends LivePath>(
  channels: T[],
  reporters: ReadonlyMap<string, number>,
): T[] {
  return channels.filter((channel) => (reporters.get(streamKey(channel)) ?? 0) < DELIST_THRESHOLD);
}
