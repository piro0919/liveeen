/**
 * 「ホーム画面に追加」を押したときにすること（use-pwa の usePwa の値から決める）。
 * Chrome 系はブラウザの確認（prompt）を出す。iOS は API が無いので、共有ボタンから追加する手順を案内する（guide）。
 * 入れた後と、どちらもできない端末と、確認をやめた後では出さない（null）。
 * やめた後に出さないのは、ブラウザの確認は1つの知らせにつき1回しか出せず、もう一度押しても何も起きないため
 */
export function installChoice({
  canInstall,
  isInstalled,
  needsManualInstall,
  dismissed,
}: {
  canInstall: boolean;
  isInstalled: boolean;
  needsManualInstall: boolean;
  dismissed: boolean;
}): 'prompt' | 'guide' | null {
  if (isInstalled) return null;
  if (canInstall) return dismissed ? null : 'prompt';
  return needsManualInstall ? 'guide' : null;
}
