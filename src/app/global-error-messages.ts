/**
 * global-error.tsx の文言。外枠ごと落ちたときの画面で、next-intl の用意（ルートの layout）が無いので、
 * messages/ja.json の errorPage を写して持つ（onigiri と同じ置き方）。
 * ja.json と同じかは test/messages.test.ts が確かめる
 */
export const GLOBAL_ERROR_TEXTS = {
  title: 'うまく表示できませんでした',
  message: '少しおいて、もう一度お試しください',
  retry: 'もう一度',
  home: 'トップへ',
};
