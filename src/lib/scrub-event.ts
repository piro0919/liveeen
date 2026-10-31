import type { ErrorEvent } from '@sentry/nextjs';

/*
 * Sentry へ送る前に削る中身（src/lib/monitoring.ts の beforeSend）。onigiri の scrub-event.ts を写した。
 * 鍵を読まないよう別のファイルに置き、test/scrub-event.test.ts で確かめる
 */

/** 問い合わせの文字列ごと落とす。ログインの戻り先には認可コードが、メールの配信停止には札が載る */
function scrubUrl(url: string | undefined): string | undefined {
  return url?.split('?')[0];
}

/**
 * 送る前に中身を削る。**本文・Cookie・ヘッダーは送らない**——本文にはコメントや配信の題が、
 * ヘッダーには IP（x-forwarded-for）と配信の鍵（Authorization）が、Cookie にはログインの状態が載る
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    event.request.url = scrubUrl(event.request.url);
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
    delete event.request.query_string;
  }
  // Next.js が別に添える道にも、問い合わせの文字列が載る
  const nextjs = event.contexts?.nextjs;
  if (nextjs !== undefined && typeof nextjs.request_path === 'string') {
    nextjs.request_path = scrubUrl(nextjs.request_path);
  }
  // 落ちる前の足跡は丸ごと送らない。console.error の中身（DB のエラーには保存しかけた行）が入る
  delete event.breadcrumbs;
  return event;
}
