'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { blockCommenterAction, commentTokenAction } from '@/app/[channelId]/actions';
import {
  BLOCKED,
  type Comment,
  COMMENT_MAX,
  type RelayMessage,
  TOKEN_EXPIRED,
} from '@/lib/comment';
import { COMMENT_TOKEN_TTL_MS } from '@/lib/comment-token';
import { normalizeDisplayName } from '@/lib/display-name';
import { DisplayNameForm } from './display-name-form';
import { SignInButton } from './sign-in-button';

/** 中継が切れたとき、もう一度つなぎに行くまでの間 */
const RETRY_MS = 3000;
/** 札が切れるより、これだけ前に新しい札でつなぎ直す */
const REFRESH_MARGIN_MS = 60_000;
const REFRESH_MS = COMMENT_TOKEN_TTL_MS - REFRESH_MARGIN_MS;
/** 画面に残すコメントの数 */
const SHOWN_MAX = 200;
/** ログインしていない人の名前を、このブラウザに覚えておく場所 */
const GUEST_NAME_KEY = 'liveeen.guestName';

/**
 * ログインしていない人の名前。このブラウザに覚えておく。
 * 覚えておけないブラウザでも、この画面を開いているあいだは使えるように、手元にも持つ
 */
let guestNameInMemory: string | null = null;
const guestNameListeners = new Set<() => void>();

function readGuestName(): string | null {
  try {
    return localStorage.getItem(GUEST_NAME_KEY) ?? guestNameInMemory;
  } catch {
    return guestNameInMemory;
  }
}

function saveGuestName(name: string): void {
  guestNameInMemory = name;
  try {
    localStorage.setItem(GUEST_NAME_KEY, name);
  } catch {
    // 覚えておけなくても、手元の分で続けられる
  }
  for (const listener of guestNameListeners) listener();
}

function subscribeGuestName(listener: () => void): () => void {
  guestNameListeners.add(listener);
  return () => guestNameListeners.delete(listener);
}

type Props = {
  channelId: string;
  relayUrl: string;
  /** 見ている人。ログインしていない／名前がまだ／書ける */
  viewer: 'signed-out' | 'no-name' | 'ready';
  /** ログインしていない人も書けるか。配信者が選ぶ */
  guestComments: boolean;
  /** 配信者が自分のチャンネルを見ている。コメントした人をブロックできる */
  own: boolean;
};

/**
 * コメント。中継（relay/）につなぎ、届いたものを流す。
 * 書けるのは、ログインして名前を付けた人と、配信者が許していればログインしていない人（その場で名前を入れる）。
 * つなぐたびにサーバーから札をもらい、札が切れる前につなぎ直す
 */
export function Comments({ channelId, relayUrl, viewer, guestComments, own }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  // 覚えておいた名前は、画面が開いてから読む（サーバーでは読めない）
  const guestName = useSyncExternalStore(subscribeGuestName, readGuestName, () => null);
  const [editingGuestName, setEditingGuestName] = useState(false);
  // 配信者に止められていれば、書く欄を出さない
  const [blocked, setBlocked] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const list = useRef<HTMLOListElement>(null);

  const guest = viewer === 'signed-out' && guestComments;
  const writer = viewer === 'ready' || (guest && guestName !== null);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let refresh: ReturnType<typeof setTimeout> | undefined;

    async function connect() {
      const result = writer
        ? await commentTokenAction(channelId, viewer === 'ready' ? null : guestName)
        : null;
      if (cancelled) return;
      const token = result?.token ?? null;
      setBlocked(result?.blocked ?? false);
      const query = token ? `?token=${encodeURIComponent(token)}` : '';
      const ws = new WebSocket(`${relayUrl}/${channelId}${query}`);
      socket.current = ws;
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as RelayMessage;
        if (message.type === 'history') setComments(message.comments);
        else if (message.type === 'remove') {
          setComments((shown) => shown.filter((comment) => !message.ids.includes(comment.id)));
        } else if (message.type === 'comment') {
          setComments((shown) => [...shown, message.comment].slice(-SHOWN_MAX));
        } else setError(message.message);
      };
      ws.onclose = (event) => {
        clearTimeout(refresh);
        if (socket.current === ws) socket.current = null;
        if (cancelled) return;
        // 札が切れたか、ブロックされて閉じられたときは、待たずに新しい札でつなぐ（止められていれば札は出ない）
        const wait = event.code === TOKEN_EXPIRED || event.code === BLOCKED ? 0 : RETRY_MS;
        retry = setTimeout(() => void connect(), wait);
      };
      if (token) refresh = setTimeout(() => ws.close(), REFRESH_MS);
    }

    void connect();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      clearTimeout(refresh);
      socket.current?.close();
      socket.current = null;
    };
  }, [channelId, relayUrl, viewer, writer, guestName]);

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

  /** 配信者が、コメントした人を止める。サイトに覚えさせてから、中継にも知らせてその場で効かせる */
  async function block(comment: Comment) {
    const { author } = comment;
    if (!author) return;
    if (
      !window.confirm(
        `${comment.name}さんをブロックしますか？このチャンネルでコメントできなくなります`,
      )
    ) {
      return;
    }
    await blockCommenterAction(channelId, author);
    socket.current?.send(JSON.stringify({ block: author }));
  }

  function decideGuestName(form: FormData) {
    const result = normalizeDisplayName(String(form.get('name') ?? ''));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    saveGuestName(result.name);
    setEditingGuestName(false);
    setError(null);
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-bold">コメント</h2>
      <ol ref={list} className="flex h-64 flex-col gap-1 overflow-y-auto rounded border p-2">
        {comments.map((comment) => (
          <li key={comment.id} className="wrap-break-word">
            <span className="font-bold">{comment.name}</span>
            {comment.guest && <span className="text-sm text-gray-500">（ゲスト）</span>}{' '}
            {comment.text}
            {own && comment.author && (
              <>
                {' '}
                <button
                  type="button"
                  className="text-sm text-gray-500 underline"
                  onClick={() => void block(comment)}
                >
                  ブロック
                </button>
              </>
            )}
          </li>
        ))}
      </ol>
      {viewer === 'signed-out' && !guestComments && (
        <div className="flex items-center gap-2">
          <p>コメントするにはログインしてください</p>
          <SignInButton />
        </div>
      )}
      {viewer === 'no-name' && <DisplayNameForm name={null} />}
      {guest && (guestName === null || editingGuestName) && (
        <form action={decideGuestName} className="flex gap-2">
          <input
            name="name"
            defaultValue={guestName ?? ''}
            required
            className="flex-1 rounded border px-2 py-1"
            aria-label="名前"
            placeholder="名前"
            autoComplete="nickname"
          />
          <button type="submit" className="rounded border px-4 py-2">
            決める
          </button>
        </form>
      )}
      {blocked && <p>この配信者のチャンネルではコメントできません</p>}
      {writer && !blocked && !editingGuestName && (
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
      {guest && guestName !== null && !editingGuestName && (
        <p className="text-sm">
          名前：{guestName}{' '}
          <button type="button" className="underline" onClick={() => setEditingGuestName(true)}>
            変える
          </button>
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
