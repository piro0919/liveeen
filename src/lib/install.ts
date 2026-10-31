/** iOS / iPadOS か（vocafy と同じ）。iPad の Safari は Mac を名乗るので、触れる Mac は iPad とみなす */
export function isAppleDevice(agent: string, maxTouchPoints: number): boolean {
  const lower = agent.toLowerCase();
  return /iphone|ipad|ipod/.test(lower) || (lower.includes('macintosh') && maxTouchPoints > 1);
}

/**
 * 「ホーム画面に追加」を押したときにすること。Chrome 系はブラウザの確認（prompt）を出す。
 * iOS は API が無いので、共有ボタンから追加する手順を案内する（guide）。入れた後と、どちらもできない端末では出さない（null）
 */
export function installChoice({
  canInstall,
  isInstalled,
  isApple,
}: {
  canInstall: boolean;
  isInstalled: boolean;
  isApple: boolean;
}): 'prompt' | 'guide' | null {
  if (isInstalled) return null;
  if (canInstall) return 'prompt';
  return isApple ? 'guide' : null;
}
