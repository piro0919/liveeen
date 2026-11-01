/** 配信中の画面の「…」のシートに並ぶ項目 */
export type LiveMenuItem = 'microphone' | 'bgm' | 'title' | 'commentRules' | 'share';

/**
 * シートに並べる項目。タイトル・コメントの管理・共有は見ている人がいるときだけ意味があるので、練習では出さない。
 * マイクは2つ以上あるとき、BGM は曲の置き場所があるときだけ。空なら「…」そのものを出さない
 */
export function liveMenuItems({
  live,
  manyMicrophones,
  hasBgm,
}: {
  live: boolean;
  manyMicrophones: boolean;
  hasBgm: boolean;
}): LiveMenuItem[] {
  return [
    ...(manyMicrophones ? (['microphone'] as const) : []),
    ...(hasBgm ? (['bgm'] as const) : []),
    ...(live ? (['title', 'commentRules', 'share'] as const) : []),
  ];
}
