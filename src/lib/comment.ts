/** コメントの長さの上限。見た目の文字数で数える */
export const COMMENT_MAX = 200;

const graphemes = new Intl.Segmenter('ja', { granularity: 'grapheme' });

/** 改行やタブは空白にする。コメントは1行で流す */
const LINE_BREAKS = /[\p{Cc}\p{Zl}\p{Zp}]+/gu;

/** 中継と見る画面がやりとりするコメント */
export type Comment = { id: string; name: string; text: string; at: number };

/** 中継から見る画面に送るもの */
export type RelayMessage =
  | { type: 'history'; comments: Comment[] }
  | { type: 'comment'; comment: Comment }
  | { type: 'error'; message: string };

/** 書かれたコメントを、流してよい形にする。空か長すぎれば null */
export function normalizeComment(input: string): string | null {
  const text = input.replace(LINE_BREAKS, ' ').trim();
  if (text === '') return null;
  if ([...graphemes.segment(text)].length > COMMENT_MAX) return null;
  return text;
}
