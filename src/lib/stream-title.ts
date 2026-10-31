/** タイトルの長さの上限。見た目の文字数で数える。カードで2行に収まるくらい（仮に決めた） */
export const STREAM_TITLE_MAX = 100;

const graphemes = new Intl.Segmenter('ja', { granularity: 'grapheme' });

/** 改行やタブは空白にする。タイトルは1行で出す */
const LINE_BREAKS = /[\p{Cc}\p{Zl}\p{Zp}]+/gu;

/**
 * 配信者が入れたタイトルを、保存してよい形にする。空ならタイトルを消す（null）。
 * 長すぎれば理由を返す
 */
export function normalizeStreamTitle(
  input: string,
): { ok: true; title: string | null } | { ok: false; error: string } {
  const title = input.replace(LINE_BREAKS, ' ').trim();
  if (title === '') return { ok: true, title: null };
  if ([...graphemes.segment(title)].length > STREAM_TITLE_MAX) {
    return { ok: false, error: `${STREAM_TITLE_MAX}文字までです` };
  }
  return { ok: true, title };
}
