'use client';

import { useEffect, useRef, useState } from 'react';
import { commentTokenAction } from '@/app/[channelId]/actions';
import { type Comment, COMMENT_MAX, type RelayMessage } from '@/lib/comment';
import { DisplayNameForm } from './display-name-form';
import { SignInButton } from './sign-in-button';

/** 中継が切れたとき、もう一度つなぎに行くまでの間 */
const RETRY_MS = 3000;
/** 画面に残すコメントの数 */
const SHOWN_MAX = 200;

type Props = {
  channelId: string;
  relayUrl: string;
  /** 見ている人。ログインしていない／名前がまだ／書ける */
  viewer: 'signed-out' | 'no-name' | 'ready';
};

/**
 * コメント。中継（relay/）につなぎ、届いたものを流す。
 * 書けるのはログインして名前を付けた人だけ。つなぐたびにサーバーから札をもらう（札は10分で切れる）
 */
export function Comments({ channelId, relayUrl, viewer }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const socket = useRef<WebSocket | null>(null);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function connect() {
      const token = viewer === 'ready' ? await commentTokenAction(channelId) : null;
      if (cancelled) return;
      const query = token ? `?token=${encodeURIComponent(token)}` : '';
      const ws = new WebSocket(`${relayUrl}/${channelId}${query}`);
      socket.current = ws;
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as RelayMessage;
        if (message.type === 'history') setComments(message.comments);
        else if (message.type === 'comment') {
          setComments((shown) => [...shown, message.comment].slice(-SHOWN_MAX));
        } else setError(message.message);
      };
      ws.onclose = () => {
        if (socket.current === ws) socket.current = null;
        if (!cancelled) retry = setTimeout(() => void connect(), RETRY_MS);
      };
    }

    void connect();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      socket.current?.close();
      socket.current = null;
    };
  }, [channelId, relayUrl, viewer]);

  // 新しいコメントが来たら下まで送る
  useEffect(() => {
    const element = list.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [comments]);

  function post() {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || text.trim() === '') return;
    ws.send(JSON.stringify({ text }));
    setText('');
    setError(null);
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-bold">コメント</h2>
      <ol ref={list} className="flex h-64 flex-col gap-1 overflow-y-auto rounded border p-2">
        {comments.map((comment) => (
          <li key={comment.id} className="wrap-break-word">
            <span className="font-bold">{comment.name}</span> {comment.text}
          </li>
        ))}
      </ol>
      {viewer === 'signed-out' && (
        <div className="flex items-center gap-2">
          <p>コメントするにはログインしてください</p>
          <SignInButton />
        </div>
      )}
      {viewer === 'no-name' && <DisplayNameForm name={null} />}
      {viewer === 'ready' && (
        <form action={post} className="flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={COMMENT_MAX * 2}
            className="flex-1 rounded border px-2 py-1"
            aria-label="コメント"
          />
          <button type="submit" className="rounded border px-4 py-2">
            送信
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
