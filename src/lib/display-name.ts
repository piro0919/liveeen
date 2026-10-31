/** 名前の長さの上限。見た目の文字数で数える（絵文字の組み合わせも1文字） */
export const DISPLAY_NAME_MAX = 20;

const graphemes = new Intl.Segmenter('ja', { granularity: 'grapheme' });

/** 改行やタブなど、名前の中にあると表示が崩れる文字（制御文字と、行・段落の区切り） */
const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}]/u;

/**
 * 本人が入れた名前を、そのまま保存してよい形にする。前後の空白は落とす。
 * 使えなければ理由の鍵を返す（文言は messages/ja.json の displayName.errors）
 */
export function normalizeDisplayName(
  input: string,
): { ok: true; name: string } | { ok: false; error: 'empty' | 'control' | 'tooLong' } {
  const name = input.trim();
  if (name === '') return { ok: false, error: 'empty' };
  if (CONTROL.test(name)) return { ok: false, error: 'control' };
  if ([...graphemes.segment(name)].length > DISPLAY_NAME_MAX) {
    return { ok: false, error: 'tooLong' };
  }
  return { ok: true, name };
}
