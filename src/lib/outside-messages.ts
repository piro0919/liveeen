import { createTranslator } from 'next-intl';
import messages from '../../messages/ja.json';

/**
 * 画面の要求の外で文言を使うとき（after() の中で送る通知やメール、テスト）の訳し手。
 * 送り先の言語はまだ持っていないので、日本語に決め打ちにする
 */
export function outsideTranslator<Namespace extends keyof typeof messages>(namespace: Namespace) {
  return createTranslator({ locale: 'ja', messages, namespace });
}
