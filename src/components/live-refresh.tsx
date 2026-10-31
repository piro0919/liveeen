'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** 読み直す間隔（ミリ秒）。読むたびに配信サーバーの API と DB に聞くので、細かくしすぎない */
const REFRESH_MS = 30_000;

/**
 * トップの配信の一覧を、開いている間に読み直す（鯉魂の live-refresh と同じ形）。
 * 無いと、始まった配信も終わった配信も、読み直すまで一覧に出ない。
 * タブが裏にある間は読み直さず、前に戻ったときにすぐ読み直す
 */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);

  return null;
}
