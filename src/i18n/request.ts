import { getRequestConfig } from 'next-intl/server';

/**
 * 画面の文言。いまは日本語だけなので、言語を URL に含めず決め打ちにする（onigiri と同じ）。
 * 海外向けを足すときは、ここで訪問者の言語を選ぶか、URL に言語を含める形（next-intl の routing）に広げる
 */
export default getRequestConfig(async () => {
  const locale = 'ja';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
