import { describe, expect, it } from 'vitest';
import type { Comment } from '@/lib/comment';
import { commentActions, hasCommentActions } from '@/lib/comment-actions';

const base: Comment = { id: 'c1', name: 'A', text: 'hello', at: 1, guest: false };
const viewer = { own: false, moderator: false, overlay: false, canReportComments: true };

describe('commentActions', () => {
  it('a viewer can only report, and only comments with a proof written by someone else', () => {
    const withProof = { ...base, proof: 'p' };
    expect(commentActions(withProof, viewer)).toEqual({
      report: true,
      remove: false,
      block: false,
      appoint: false,
    });
    expect(commentActions(base, viewer).report).toBe(false);
    expect(commentActions({ ...withProof, mine: true }, viewer).report).toBe(false);
  });

  it('a signed-out viewer has nothing, so the name cannot be pressed', () => {
    const actions = commentActions(
      { ...base, proof: 'p' },
      { ...viewer, canReportComments: false },
    );
    expect(hasCommentActions(actions)).toBe(false);
  });

  it('the streamer can remove any comment, and block and appoint those with an author', () => {
    const own = { ...viewer, own: true, canReportComments: false };
    expect(commentActions(base, own)).toEqual({
      report: false,
      remove: true,
      block: false,
      appoint: false,
    });
    expect(commentActions({ ...base, author: 'x' }, own)).toEqual({
      report: false,
      remove: true,
      block: true,
      appoint: true,
    });
  });

  it('guests cannot be appointed, and the live screen does not appoint', () => {
    const own = { ...viewer, own: true };
    const author = { ...base, author: 'x' };
    expect(commentActions({ ...author, guest: true }, own).appoint).toBe(false);
    expect(commentActions(author, { ...own, overlay: true }).appoint).toBe(false);
  });

  it('a moderator removes their own comments and those they could block, not others', () => {
    const moderator = { ...viewer, moderator: true };
    expect(commentActions(base, moderator).remove).toBe(false);
    expect(commentActions({ ...base, mine: true }, moderator).remove).toBe(true);
    expect(commentActions({ ...base, author: 'x' }, moderator).remove).toBe(true);
    expect(commentActions({ ...base, author: 'x' }, moderator).appoint).toBe(false);
  });
});
