import { describe, expect, it } from 'vitest';
import { COMMENT_MAX } from '@/lib/comment';
import { CommentOutbox } from '@/lib/comment-outbox';

function socket(readyState: number) {
  const sent: unknown[] = [];
  return {
    readyState,
    sent,
    send: (data: string) => {
      sent.push(JSON.parse(data));
    },
  };
}

describe('CommentOutbox', () => {
  it('つながっていればブロックをすぐ送る', () => {
    const outbox = new CommentOutbox();
    const open = socket(WebSocket.OPEN);
    outbox.block(open, 'a1');
    expect(open.sent).toEqual([{ block: 'a1' }]);
  });

  it('つなぎ直しの最中のブロックは、つながったときに一度だけ送る', () => {
    const outbox = new CommentOutbox();
    outbox.block(null, 'a1');
    outbox.block(socket(WebSocket.CONNECTING), 'a2');
    const next = socket(WebSocket.OPEN);
    outbox.opened(next);
    expect(next.sent).toEqual([{ block: 'a1' }, { block: 'a2' }]);
    const after = socket(WebSocket.OPEN);
    outbox.opened(after);
    expect(after.sent).toEqual([]);
  });

  it('つながっていなければコメントを送らない', () => {
    const outbox = new CommentOutbox();
    const connecting = socket(WebSocket.CONNECTING);
    expect(outbox.post(connecting, 'こんにちは')).toBe('closed');
    expect(outbox.post(null, 'こんにちは')).toBe('closed');
    expect(connecting.sent).toEqual([]);
    expect(outbox.refused()).toBeNull();
  });

  it('中継が黙って捨てる長さの文は送らない', () => {
    const outbox = new CommentOutbox();
    const open = socket(WebSocket.OPEN);
    expect(outbox.post(open, 'あ'.repeat(COMMENT_MAX + 1))).toBe('invalid');
    expect(open.sent).toEqual([]);
    expect(outbox.post(open, 'あ'.repeat(COMMENT_MAX))).toBe('sent');
  });

  it('断られたら送った順に文を返す', () => {
    const outbox = new CommentOutbox();
    const open = socket(WebSocket.OPEN);
    expect(outbox.post(open, 'こんにちは')).toBe('sent');
    expect(open.sent).toEqual([{ text: 'こんにちは' }]);
    expect(outbox.refused()).toBe('こんにちは');
    expect(outbox.refused()).toBeNull();
  });

  it('前のコメントの返事が来ても、続けて送った文は断られたら戻せる', () => {
    const outbox = new CommentOutbox();
    const open = socket(WebSocket.OPEN);
    outbox.post(open, 'A');
    outbox.post(open, 'B');
    outbox.accepted('A');
    expect(outbox.refused()).toBe('B');
  });

  it('別のタブで書いた自分のコメントでは、送った文を忘れない', () => {
    const outbox = new CommentOutbox();
    outbox.post(socket(WebSocket.OPEN), 'X');
    outbox.accepted('別のタブ');
    expect(outbox.refused()).toBe('X');
  });

  it('返事の来ないまま切れたら、いちばん前の文を返して残りを忘れる', () => {
    const outbox = new CommentOutbox();
    const open = socket(WebSocket.OPEN);
    outbox.post(open, 'A');
    outbox.post(open, 'B');
    expect(outbox.closed()).toBe('A');
    expect(outbox.closed()).toBeNull();
    expect(outbox.refused()).toBeNull();
  });

  it('返事が来た文は、切れても戻さない', () => {
    const outbox = new CommentOutbox();
    outbox.post(socket(WebSocket.OPEN), ' こんにちは\n');
    outbox.accepted('こんにちは');
    expect(outbox.closed()).toBeNull();
  });
});
