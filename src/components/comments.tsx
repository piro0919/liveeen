'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  blockCommenterAction,
  commentTokenAction,
  reportCommentAction,
} from '@/app/[channelId]/actions';
import {
  BLOCKED,
  type Comment,
  COMMENT_MAX,
  type RelayMessage,
  TOKEN_EXPIRED,
} from '@/lib/comment';
import { COMMENT_TOKEN_TTL_MS } from '@/lib/comment-token';
import { normalizeDisplayName } from '@/lib/display-name';
import { ui } from '@/lib/ui';
import { Avatar } from './avatar';
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
  /** ログインした人が通報したコメントの id。null ならコメントを通報できない（ログインしていないか、配信者） */
  reportedComments: string[] | null;
  /** 配信中の画面の映像に重ねて出す。地を塗らず、見出しを出さない */
  overlay?: boolean;
};

/**
 * コメント。中継（relay/）につなぎ、届いたものを流す。
 * 書けるのは、ログインして名前を付けた人と、配信者が許していればログインしていない人（その場で名前を入れる）。
 * つなぐたびにサーバーから札をもらい、札が切れる前につなぎ直す
 */
export function Comments({
  channelId,
  relayUrl,
  viewer,
  guestComments,
  own,
  reportedComments,
  overlay = false,
}: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  // 覚えておいた名前は、画面が開いてから読む（サーバーでは読めない）
  const guestName = useSyncExternalStore(subscribeGuestName, readGuestName, () => null);
  const [editingGuestName, setEditingGuestName] = useState(false);
  // 配信者に止められていれば、書く欄を出さない
  const [blocked, setBlocked] = useState(false);
  // 通報したコメント。読み込み直しても「通報しました」のままにするため、サーバーから受け取った分から始める
  const [reported, setReported] = useState(() => new Set(reportedComments ?? []));
  const socket = useRef<WebSocket | null>(null);
  // 中継につながるまで送れない。押せるままだと、開いてすぐ送った分が黙って捨てられる
  const [connected, setConnected] = useState(false);
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
      // 札なしのつなぎは読むだけで、送っても中継に断られる。札を持ってつながったときだけ送れる
      ws.onopen = () => {
        if (socket.current === ws) setConnected(token !== null);
      };
      // 札を取り替えるために自分で閉じたか
      let refreshing = false;
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as RelayMessage;
        if (message.type === 'history') setComments(message.comments);
        else if (message.type === 'remove') {
          setComments((shown) => shown.filter((comment) => !message.ids.includes(comment.id)));
        } else if (message.type === 'comment') {
          setComments((shown) => [...shown, message.comment].slice(-SHOWN_MAX));
        } else if (message.type === 'error') setError(message.message);
      };
      ws.onclose = (event) => {
        clearTimeout(refresh);
        if (socket.current === ws) {
          socket.current = null;
          setConnected(false);
        }
        if (cancelled) return;
        // 札を取り替えるとき、札が切れたか、ブロックされて閉じられたときは、待たずに新しい札でつなぐ（止められていれば札は出ない）
        const wait =
          refreshing || event.code === TOKEN_EXPIRED || event.code === BLOCKED ? 0 : RETRY_MS;
        retry = setTimeout(() => void connect(), wait);
      };
      if (token) {
        refresh = setTimeout(() => {
          // 閉じ終わるまでの間に押されても、黙って捨てないよう先に止める
          refreshing = true;
          setConnected(false);
          ws.close();
        }, REFRESH_MS);
      }
    }

    void connect();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      clearTimeout(refresh);
      socket.current?.close();
      socket.current = null;
      setConnected(false);
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

  /** コメントを通報する。運営が管理画面で見て、消すかを決める */
  async function report(comment: Comment) {
    if (!window.confirm(`${comment.name}さんのこのコメントを通報しますか？`)) return;
    try {
      await reportCommentAction(channelId, comment);
    } catch {
      setError('通報できませんでした。読み込み直してから、もう一度試してください');
      return;
    }
    setReported((ids) => new Set(ids).add(comment.id));
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
    // 手本は YouTube のライブチャット：枠の上に見出し、真ん中に流れ、下に書く欄
    <section className={`flex min-h-0 flex-1 flex-col ${overlay ? ui.overlayComments : ui.panel}`}>
      {!overlay && (
        <h2 className="flex h-12 shrink-0 items-center border-b border-line px-4 font-medium">
          コメント
        </h2>
      )}
      <ol
        ref={list}
        className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 py-2 ${overlay ? 'stack-bottom' : ''}`}
      >
        {comments.map((comment) => (
          <li key={comment.id} className="flex gap-3 text-sm">
            <Avatar name={comment.name} size="xs" />
            <p className="min-w-0 wrap-break-word">
              <span className={overlay ? ui.overlayName : 'text-muted'}>
                {comment.name}
                {comment.guest && '（ゲスト）'}
              </span>{' '}
              {comment.text}
              {own && comment.author && (
                <>
                  {' '}
                  <button
                    type="button"
                    className={overlay ? ui.overlayTextButton : ui.textButton}
                    onClick={() => void block(comment)}
                  >
                    ブロック
                  </button>
                </>
              )}
              {reportedComments && !comment.mine && comment.proof && (
                <>
                  {' '}
                  {reported.has(comment.id) ? (
                    <span className={ui.note}>通報しました</span>
                  ) : (
                    <button
                      type="button"
                      className={ui.textButton}
                      onClick={() => void report(comment)}
                    >
                      通報
                    </button>
                  )}
                </>
              )}
            </p>
          </li>
        ))}
      </ol>
      <div className={`flex shrink-0 flex-col gap-2 p-3 ${overlay ? '' : 'border-t border-line'}`}>
        {viewer === 'signed-out' && !guestComments && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm">コメントするにはログインしてください</p>
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
              className={`flex-1 ${ui.input}`}
              aria-label="名前"
              placeholder="名前"
              autoComplete="nickname"
            />
            <button type="submit" className={ui.tonalButton}>
              決める
            </button>
          </form>
        )}
        {blocked && <p className="text-sm">この配信者のチャンネルではコメントできません</p>}
        {writer && !blocked && !editingGuestName && (
          <form action={post} className="flex gap-2">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={COMMENT_MAX * 2}
              className={`flex-1 ${overlay ? ui.overlayInput : ui.input}`}
              aria-label="コメント"
              placeholder={overlay ? 'コメント' : undefined}
            />
            <button
              type="submit"
              className={overlay ? ui.overlayButton : ui.tonalButton}
              disabled={!connected}
            >
              送信
            </button>
          </form>
        )}
        {guest && guestName !== null && !editingGuestName && (
          <p className={ui.note}>
            名前：{guestName}{' '}
            <button
              type="button"
              className={ui.textButton}
              onClick={() => setEditingGuestName(true)}
            >
              変える
            </button>
          </p>
        )}
        {error && <p className={ui.error}>{error}</p>}
      </div>
    </section>
  );
}
