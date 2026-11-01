/**
 * 見えない書式文字（ゼロ幅の空白、文字の向きを変える印など）。空白に見える名前や、逆向きに見える文を作れてしまい、
 * 禁止語の間に挟めばすり抜けられる。絵文字の組み合わせに使う U+200D と、旗の絵文字に使うタグ文字は残す
 */
const INVISIBLE = /(?![‍\u{E0020}-\u{E007F}])\p{Cf}/gu;

/** 文字として見えないもの（空白、無視される文字、点字の空白 U+2800） */
const BLANK = /[\p{White_Space}\p{Default_Ignorable_Code_Point}⠀]/gu;

/** 見えない書式文字を含むか */
export function hasInvisible(text: string): boolean {
  return text.search(INVISIBLE) !== -1;
}

/** 見えない書式文字を取り除く */
export function withoutInvisible(text: string): string {
  return text.replace(INVISIBLE, '');
}

/** 目に見える文字が1つでもあるか */
export function hasVisibleText(text: string): boolean {
  return text.replace(BLANK, '') !== '';
}
