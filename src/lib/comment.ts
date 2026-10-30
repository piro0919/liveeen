/** コメントの長さの上限。見た目の文字数で数える */
export const COMMENT_MAX = 200;

const graphemes = new Intl.Segmenter('ja', { granularity: 'grapheme' });

/** 改行やタブは空白にする。コメントは1行で流す */
const LINE_BREAKS = /[\p{Cc}\p{Zl}\p{Zp}]+/gu;

/**
 * 中継と見る画面がやりとりするコメント。guest はログインしていない人が書いたもの。
 * 名前は重なってよいので、ログインしていない人がほかの人の名前を名乗っても見分けられるよう、画面で印を付ける
 */
export type Comment = {
  id: string;
  name: string;
  text: string;
  at: number;
  guest: boolean;
  /** 書いた人の札（src/lib/comment-token.ts の signAuthor）。配信者にだけ付ける。ブロックに使う */
  author?: string;
};

/** ログインしていない人の札に振る id の頭。札ごとに `guest:<uuid>` を振る */
const GUEST_ID_PREFIX = 'guest:';

export function guestId(uuid: string): string {
  return `${GUEST_ID_PREFIX}${uuid}`;
}

export function isGuestId(userId: string): boolean {
  return userId.startsWith(GUEST_ID_PREFIX);
}

/** 中継が、札の期限が切れたつなぎを閉じるときの番号（4000 番台は使う側が決めてよい） */
export const TOKEN_EXPIRED = 4001;
/** 中継が、配信者にブロックされた人のつなぎを閉じるときの番号。見る画面は札をもらい直し、読むだけでつなぐ */
export const BLOCKED = 4003;

/** 中継から見る画面に送るもの。remove はブロックされた人のコメントを画面から消す */
export type RelayMessage =
  | { type: 'history'; comments: Comment[] }
  | { type: 'comment'; comment: Comment }
  | { type: 'remove'; ids: string[] }
  | { type: 'error'; message: string };

/** 書かれたコメントを、流してよい形にする。空か長すぎれば null */
export function normalizeComment(input: string): string | null {
  const text = input.replace(LINE_BREAKS, ' ').trim();
  if (text === '') return null;
  if ([...graphemes.segment(text)].length > COMMENT_MAX) return null;
  return text;
}
