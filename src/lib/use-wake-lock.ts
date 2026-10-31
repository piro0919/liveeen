'use client';

import { useEffect } from 'react';

/**
 * 配信している間は、スマホの画面を自動で消させない（Wake Lock API。vocafy と同じ）。
 * 画面が消えるとカメラとマイクが止まり、配信が終わる（browser-publisher.tsx）。机に置いて配信する使い方のため。
 * 取れない端末や断られたときは黙って諦める。
 * 別のアプリに切り替えるとブラウザが外すので、戻ってきたときにまだ配信していれば取り直す
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    // 取りに行っている途中。待つあいだに画面が戻ってきても、二つ目を取らない（取った片方が外れずに残る）
    let pending = false;

    const request = async () => {
      if (document.visibilityState !== 'visible' || lock || pending) return;
      pending = true;
      try {
        const next = await navigator.wakeLock.request('screen');
        // 取れるのを待つあいだに止めていたら、すぐ返す
        if (done) void next.release();
        else {
          lock = next;
          next.addEventListener('release', () => {
            if (lock === next) lock = null;
          });
        }
      } catch {
        // 何もしない
      } finally {
        pending = false;
      }
    };

    void request();
    document.addEventListener('visibilitychange', request);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', request);
      void lock?.release();
      lock = null;
    };
  }, [active]);
}
