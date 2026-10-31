/**
 * LINE の中のブラウザで開かれたら、外のブラウザで開き直すための住所（onigiri・vocafy と同じ）。
 * 配信者の住所は LINE でも配られる。LINE の中のブラウザ（WebView）は Google のログインを断られることがある
 * （Liveeen では確かめていない）。LINE は住所に openExternalBrowser=1 が付いていると外のブラウザで開くので、それを付けた住所へ移る
 */
const EXTERNAL_PARAM = 'openExternalBrowser';

const LINE_AGENT = /\sLine\//;

/** 外のブラウザへ送る住所。LINE の中でないか、もう付けて開いた住所（外へ開けなかったとき）なら null */
export function externalBrowserUrl(href: string, agent: string): string | null {
  if (!LINE_AGENT.test(agent)) return null;
  const url = new URL(href);
  if (url.searchParams.has(EXTERNAL_PARAM)) return null;
  url.searchParams.set(EXTERNAL_PARAM, '1');
  return url.toString();
}

/**
 * 外のブラウザで開いたあと、住所から印を外した住所。印が無ければ null。
 * LINE の中に残ったとき（外へ開けなかった）は外さない。外すと、読み込み直すたびに外へ送り直す
 */
export function withoutExternalParam(href: string, agent: string): string | null {
  if (LINE_AGENT.test(agent)) return null;
  const url = new URL(href);
  if (!url.searchParams.has(EXTERNAL_PARAM)) return null;
  url.searchParams.delete(EXTERNAL_PARAM);
  return url.toString();
}
