const numberFormat = new Intl.NumberFormat('ja-JP');

/** 見ている人の数の書き方。トップの札と見る画面で同じにする（文言は仮） */
export function viewersLabel(count: number): string {
  return `${numberFormat.format(count)}人が視聴中`;
}
