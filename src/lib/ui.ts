/**
 * 見た目の決まり（CLAUDE.md の Design rules）。手本は YouTube。
 * ボタン・入力欄・枠は、ここの形だけを使う。その場で書き起こすと少しずつ違う形が増えるため（test/design-rules.test.ts で止める）
 */

const BUTTON_BASE =
  'inline-flex h-9 w-fit shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap disabled:opacity-50';

export const ui = {
  /** 主な操作。YouTube の「チャンネル登録」の形 */
  primaryButton: `${BUTTON_BASE} bg-foreground text-background hover:opacity-85`,
  /** ほかの操作。YouTube の「登録済み」や「共有」の形 */
  tonalButton: `${BUTTON_BASE} bg-surface hover:bg-surface-hover`,
  /** ログインしていない人へのログイン。YouTube の右上の「ログイン」の形 */
  signInButton: `${BUTTON_BASE} border border-line px-3 text-accent hover:bg-accent/10`,
  /** 文の中の小さな操作（ブロック・変える） */
  textButton: 'text-sm text-muted hover:text-foreground',
  /** 1行の入力欄 */
  input:
    'h-9 min-w-0 rounded-lg border border-line bg-background px-3 text-sm outline-none focus:border-accent',
  /** 囲む枠（コメント・通報の理由・設定の項目） */
  panel: 'rounded-xl border border-line',
  /** 設定や配信の準備の1つのまとまり */
  card: 'flex flex-col gap-3 rounded-xl border border-line p-4',
  /** 見出し（ページ） */
  heading: 'text-xl font-bold',
  /** 見出し（まとまり） */
  subheading: 'font-bold',
  /** 文の中のリンク */
  link: 'text-accent hover:underline',
  /** チェックボックスとラジオボタン */
  check: 'size-4 accent-accent',
  /** 補いの文（時刻・状態） */
  note: 'text-sm text-muted',
  /** 失敗の理由 */
  error: 'text-sm text-danger',
} as const;
