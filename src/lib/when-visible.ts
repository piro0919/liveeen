/**
 * 画面が見えているときに run を呼ぶ。裏にあれば、前に戻ったときに呼ぶ。呼ぶ前にやめるための関数を返す。
 * 裏のタブがサーバーと DB を起こし続けないようにする（CLAUDE.md の月の上限）
 */
export function whenVisible(run: () => void): () => void {
  if (document.visibilityState === 'visible') {
    run();
    return () => undefined;
  }
  const onChange = () => {
    if (document.visibilityState !== 'visible') return;
    document.removeEventListener('visibilitychange', onChange);
    run();
  };
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}
