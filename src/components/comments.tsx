'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import {
  appointModeratorAction,
  blockCommenterAction,
  commentTokenAction,
  reportCommentAction,
} from '@/app/[channelId]/actions';
import {
  BLOCKED,
  type Comment,
  COMMENT_MAX,
  type RelayMessage,
  type RelayRefusal,
  ROLE_CHANGED,
  TOKEN_EXPIRED,
} from '@/lib/comment';
import { CommentOutbox } from '@/lib/comment-outbox';
import { COMMENT_TOKEN_TTL_MS } from '@/lib/comment-token';
import { DISPLAY_NAME_MAX, normalizeDisplayName } from '@/lib/display-name';
import { ui } from '@/lib/ui';
import { Avatar } from './avatar';
import { DisplayNameForm } from './display-name-form';
import { SignInButton } from './sign-in-button';
import { setViewers } from './viewer-count';

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

/** 中継が断った理由を、見る人に見せる文にする */
function refusalText(
  t: ReturnType<typeof useTranslations<'comments'>>,
  refusal: RelayRefusal,
): string {
  switch (refusal.code) {
    case 'followersOnly':
      return t('followersOnly', { minutes: refusal.minutes });
    case 'slowMode':
      return t('refusals.slowMode', { seconds: refusal.seconds });
    default:
      return t(`refusals.${refusal.code}`);
  }
}

type Props = {
  channelId: string;
  relayUrl: string;
  /** 見ている人。ログインしていない／名前がまだ／書ける */
  viewer: 'signed-out' | 'no-name' | 'ready';
  /** ログインしていない人も書けるか。配信者が選ぶ */
  guestComments: boolean;
  /** 配信者が自分のチャンネルを見ている。コメントした人をモデレーターにできる（ブロックは、中継が書いた人の札を付けたコメントにだけ出す） */
  own: boolean;
  /** 見ている人がこのチャンネルをフォローしているか。変わったら札をもらい直す（フォロワー限定のため） */
  following?: boolean | null;
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
  following = null,
  reportedComments,
  overlay = false,
}: Props) {
  const t = useTranslations('comments');
  const tName = useTranslations('displayName.errors');
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  // 覚えておいた名前は、画面が開いてから読む（サーバーでは読めない）
  const guestName = useSyncExternalStore(subscribeGuestName, readGuestName, () => null);
  const [editingGuestName, setEditingGuestName] = useState(false);
  // 配信者に止められていれば、書く欄を出さない
  const [blocked, setBlocked] = useState(false);
  // 配信者の決まり（フォロワー限定）でいまは書けなければ、書く欄の代わりに理由を出す。フォローしてから要る分数
  const [followersOnly, setFollowersOnly] = useState<number | null>(null);
  // モデレーターにした人の札。同じ人のほかのコメントにも「モデレーターにしました」と出す
  const [appointed, setAppointed] = useState(() => new Set<string>());
  // 通報したコメント。読み込み直しても「通報しました」のままにするため、サーバーから受け取った分から始める
  const [reported, setReported] = useState(() => new Set(reportedComments ?? []));
  const socket = useRef<WebSocket | null>(null);
  // 中継につながるまで送れない。押せるままだと、開いてすぐ送った分が黙って捨てられる
  const [connected, setConnected] = useState(false);
  // 中継に届かず、つなぎ直しを待っている。黙って押せないままにしないために知らせる
  const [unreachable, setUnreachable] = useState(false);
  const outbox = useRef(new CommentOutbox());
  const list = useRef<HTMLOListElement>(null);

  const guest = viewer === 'signed-out' && guestComments;
  const writer = viewer === 'ready' || (guest && guestName !== null);

  // t は画面の更新（refresh）のたびに作り直される。つなぎ直しの依存に入れると、タイトルを保存しただけで切れる
  const showRefusal = useEffectEvent((message: Extract<RelayMessage, { type: 'error' }>) => {
    setError(message.code ? refusalText(t, message) : message.message);
  });

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let refresh: ReturnType<typeof setTimeout> | undefined;

    /** 中継に戻された文を書く欄に戻す。その間に書き始めていれば、そちらを残す */
    function restore(returned: string | null) {
      if (returned !== null) setText((current) => (current === '' ? returned : current));
    }

    async function connect() {
      let result: Awaited<ReturnType<typeof commentTokenAction>> | null = null;
      try {
        if (writer) {
          result = await commentTokenAction(channelId, viewer === 'ready' ? null : guestName);
        }
      } catch {
        // 札をもらえなかった。黙って押せないままにせず、知らせて待ってからやり直す
        if (cancelled) return;
        setUnreachable(true);
        retry = setTimeout(() => void connect(), RETRY_MS);
        return;
      }
      if (cancelled) return;
      const token = result?.token ?? null;
      setBlocked(result?.blocked ?? false);
      setFollowersOnly(result?.followersOnly ?? null);
      const query = token ? `?token=${encodeURIComponent(token)}` : '';
      const ws = new WebSocket(`${relayUrl}/${channelId}${query}`);
      socket.current = ws;
      // 札なしのつなぎは読むだけで、送っても中継に断られる。札を持ってつながったときだけ送れる
      ws.onopen = () => {
        if (socket.current !== ws) return;
        setConnected(token !== null);
        setUnreachable(false);
        if (token) outbox.current.opened(ws);
      };
      // 札を取り替えるために自分で閉じたか
      let refreshing = false;
      /** 新しい札でつなぎ直す。閉じ終わるまでの間に押されても、黙って捨てないよう先に止める */
      const renew = () => {
        refreshing = true;
        setConnected(false);
        ws.close();
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as RelayMessage;
        if (message.type === 'history') setComments(message.comments);
        else if (message.type === 'remove') {
          setComments((shown) => shown.filter((comment) => !message.ids.includes(comment.id)));
        } else if (message.type === 'comment') {
          if (message.comment.mine) outbox.current.accepted(message.comment.text);
          setComments((shown) => [...shown, message.comment].slice(-SHOWN_MAX));
        } else if (message.type === 'error') {
          showRefusal(message);
          restore(outbox.current.refused());
        } else if (message.type === 'viewers') setViewers(channelId, message.count);
        // 配信者が決まりを変えた。書ける人は札をもらい直し、書けるかどうかの知らせを出し直す
        else if (message.type === 'rules' && writer) renew();
      };
      ws.onclose = (event) => {
        clearTimeout(refresh);
        if (socket.current === ws) {
          socket.current = null;
          setConnected(false);
        }
        if (cancelled) return;
        // 送ったのに返事の来ないまま切れた文は、届いたか分からないので書く欄に戻す
        restore(outbox.current.closed());
        // 札を取り替えるとき、札が切れたか、ブロックされたか、モデレーターになった・外れたときは、
        // 待たずに新しい札でつなぐ（止められていれば札は出ない）
        const wait =
          refreshing ||
          event.code === TOKEN_EXPIRED ||
          event.code === BLOCKED ||
          event.code === ROLE_CHANGED
            ? 0
            : RETRY_MS;
        if (wait > 0) {
          setUnreachable(true);
          // つながらない間の人数は分からない。札の取り替えのときは、すぐつなぎ直すので消さない
          setViewers(channelId, null);
        }
        retry = setTimeout(() => void connect(), wait);
      };
      if (token) {
        // フォローしてまだ時間がたっていない人は、書けるようになる時刻にも札をもらい直す
        const writable = result?.writableAt ? result.writableAt - Date.now() : Infinity;
        refresh = setTimeout(renew, Math.max(0, Math.min(REFRESH_MS, writable)));
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
      setViewers(channelId, null);
    };
  }, [channelId, relayUrl, viewer, writer, guestName, following]);

  // 新しいコメントが来たら下まで送る
  useEffect(() => {
    const element = list.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [comments]);

  function post() {
    if (text.trim() === '') return;
    const result = outbox.current.post(socket.current, text);
    if (result === 'invalid') {
      setError(t('errors.tooLong', { max: COMMENT_MAX }));
      return;
    }
    if (result === 'closed') return;
    setText('');
    setError(null);
  }

  /** 配信者が、コメントした人をモデレーターにする。サイトが中継に知らせ、その人はつなぎ直してから効く */
  async function appoint(comment: Comment) {
    const { author } = comment;
    if (!author) return;
    if (!window.confirm(t('confirmAppoint', { name: comment.name }))) {
      return;
    }
    try {
      await appointModeratorAction(channelId, author);
    } catch {
      setError(t('errors.appoint'));
      return;
    }
    setError(null);
    setAppointed((names) => new Set(names).add(author));
  }

  /** 配信者かモデレーターが、コメントした人を止める。サイトに覚えさせてから、中継にも知らせてその場で効かせる */
  async function block(comment: Comment) {
    const { author } = comment;
    if (!author) return;
    if (!window.confirm(t('confirmBlock', { name: comment.name }))) {
      return;
    }
    try {
      await blockCommenterAction(channelId, author);
    } catch {
      // 相手がモデレーターになっていた、などで断られた
      setError(t('errors.block'));
      return;
    }
    setError(null);
    // つなぎ直しの最中なら、つながったときに送る
    outbox.current.block(socket.current, author);
  }

  /** コメントを通報する。運営が管理画面で見て、消すかを決める */
  async function report(comment: Comment) {
    if (!window.confirm(t('confirmReport', { name: comment.name }))) return;
    try {
      await reportCommentAction(channelId, comment);
    } catch {
      setError(t('errors.report'));
      return;
    }
    setReported((ids) => new Set(ids).add(comment.id));
  }

  function decideGuestName(form: FormData) {
    const result = normalizeDisplayName(String(form.get('name') ?? ''));
    if (!result.ok) {
      setError(tName(result.error, { max: DISPLAY_NAME_MAX }));
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
          {t('heading')}
        </h2>
      )}
      <ol
        ref={list}
        className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 py-2 ${overlay ? 'stack-bottom' : ''}`}
      >
        {comments.map((comment) => (
          <li key={comment.id} className="flex gap-3 text-sm">
            <Avatar name={comment.name} src={comment.avatar} size="xs" />
            <p className="min-w-0 wrap-break-word">
              <span className={overlay ? ui.overlayName : 'text-muted'}>
                {comment.name}
                {comment.guest && t('guestMark')}
              </span>{' '}
              {comment.text}
              {/* 書いた人の札は、配信者とモデレーターにだけ中継が付ける（relay/relay.ts） */}
              {comment.author && (
                <>
                  {' '}
                  <button
                    type="button"
                    className={overlay ? ui.overlayTextButton : ui.textButton}
                    onClick={() => void block(comment)}
                  >
                    {t('block')}
                  </button>
                </>
              )}
              {/* 配信中の画面は狭いので、モデレーターを選ぶのは見る画面と OBS の画面だけ */}
              {own && !overlay && comment.author && !comment.guest && (
                <>
                  {' '}
                  {appointed.has(comment.author) ? (
                    <span className={ui.note}>{t('appointed')}</span>
                  ) : (
                    <button
                      type="button"
                      className={ui.textButton}
                      onClick={() => void appoint(comment)}
                    >
                      {t('appoint')}
                    </button>
                  )}
                </>
              )}
              {reportedComments && !comment.mine && comment.proof && (
                <>
                  {' '}
                  {reported.has(comment.id) ? (
                    <span className={ui.note}>{t('reported')}</span>
                  ) : (
                    <button
                      type="button"
                      className={ui.textButton}
                      onClick={() => void report(comment)}
                    >
                      {t('report')}
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
            <p className="text-sm">{t('signInToComment')}</p>
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
              aria-label={t('guestName')}
              placeholder={t('guestName')}
              autoComplete="nickname"
            />
            <button type="submit" className={ui.tonalButton}>
              {t('decideName')}
            </button>
          </form>
        )}
        {unreachable && <p className="text-sm">{t('unreachable')}</p>}
        {blocked && <p className="text-sm">{t('blocked')}</p>}
        {followersOnly !== null && !blocked && (
          <p className="text-sm">{t('followersOnly', { minutes: followersOnly })}</p>
        )}
        {writer && !blocked && followersOnly === null && !editingGuestName && (
          <form action={post} className="flex gap-2">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={COMMENT_MAX * 2}
              className={`flex-1 ${overlay ? ui.overlayInput : ui.input}`}
              aria-label={t('input')}
              placeholder={overlay ? t('input') : undefined}
            />
            <button
              type="submit"
              className={overlay ? ui.overlayButton : ui.tonalButton}
              disabled={!connected}
            >
              {t('send')}
            </button>
          </form>
        )}
        {guest && guestName !== null && !editingGuestName && (
          <p className={ui.note}>
            {t('guestNameShown', { name: guestName })}{' '}
            <button
              type="button"
              className={ui.textButton}
              onClick={() => setEditingGuestName(true)}
            >
              {t('changeName')}
            </button>
          </p>
        )}
        {error && <p className={ui.error}>{error}</p>}
      </div>
    </section>
  );
}
