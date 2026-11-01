import { describe, expect, it } from 'vitest';
import type { Comment } from '@/lib/comment';
import { mergeHistory } from '@/lib/comment-history';

const comment = (at: number): Comment => ({
  id: `c${at}`,
  name: 'あ',
  text: 't',
  at,
  guest: false,
});
const ids = (comments: Comment[]) => comments.map((c) => c.at);

describe('mergeHistory', () => {
  it('中継の直近の分より古いものは残す', () => {
    const shown = [1, 2, 3, 4].map(comment);
    expect(ids(mergeHistory(shown, [3, 4, 5].map(comment), 200))).toEqual([1, 2, 3, 4, 5]);
  });

  it('直近の範囲で中継に無いものは、消されたものなので戻さない', () => {
    const shown = [1, 2, 3, 4].map(comment);
    expect(ids(mergeHistory(shown, [2, 4].map(comment), 200))).toEqual([1, 2, 4]);
  });

  it('上限を超えたら古いほうから落とす', () => {
    expect(ids(mergeHistory([1, 2, 3].map(comment), [4].map(comment), 2))).toEqual([3, 4]);
  });

  it('中継のコメントが空なら空にする（再起動した中継で、消された分を残さない）', () => {
    expect(mergeHistory([comment(1)], [], 200)).toEqual([]);
  });
});
