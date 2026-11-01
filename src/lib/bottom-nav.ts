import { isSitePath } from './handle';

/**
 * 下のタブを出す画面か。見る画面（/@ハンドルとチャンネルの id）には出さない。
 * 見る画面はコメントが画面の残りを埋め、書く欄が一番下にあるため
 */
export function showsBottomNav(pathname: string): boolean {
  const [, first = ''] = pathname.split('/');
  return first === '' || isSitePath(first);
}

/** そのタブの画面にいるか。/broadcast/obs は「配信する」の中 */
export function isActiveTab(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
