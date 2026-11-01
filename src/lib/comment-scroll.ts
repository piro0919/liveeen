/** 一番下からこの距離までは「読み終えている」とみなす（ミリ単位の端数や、1行の途中で止めた分を許す） */
const NEAR_BOTTOM_PX = 48;

/** コメントの一覧を一番下まで読んでいるか。読んでいるときだけ、新しいコメントで下へ送る */
export function isNearBottom({
  scrollTop,
  clientHeight,
  scrollHeight,
}: Pick<HTMLElement, 'scrollTop' | 'clientHeight' | 'scrollHeight'>): boolean {
  return scrollHeight - scrollTop - clientHeight <= NEAR_BOTTOM_PX;
}
