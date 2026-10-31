import { type Messages, useTranslations } from 'next-intl';

/** 画面に出す失敗の文言の鍵（messages/ja.json の errors） */
export type ScreenErrorKey = keyof Messages['errors'];

/**
 * 画面にそのまま出す失敗。文言は持たず鍵だけ持ち、画面の側で訳す（screenErrorText）。
 * lib の中では、要求の外（ブラウザの中で動く処理）なので訳せないため
 */
export class ScreenError extends Error {
  constructor(
    readonly key: ScreenErrorKey,
    readonly values?: Record<string, number>,
  ) {
    super(key);
  }
}

/** 失敗を画面に出す文にする。ScreenError は訳し、それ以外（ブラウザが出す失敗）はそのままの文を出す */
export function useScreenErrorText(): (error: unknown) => string {
  const t = useTranslations('errors');
  return (error) => {
    if (error instanceof ScreenError) return t(error.key, error.values);
    return error instanceof Error ? error.message : String(error);
  };
}
