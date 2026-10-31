/**
 * 見た目の決まり（CLAUDE.md の Design rules）。スマホで見る人が主なので、スマホの幅を基準に組み、広い画面で足す。
 * 板を重ねない：上の帯は画面の幅いっぱいで、まとまりは縁の線のない面で分ける。色は src/app/globals.css。
 * ボタン・入力欄・枠は、ここの形だけを使う。その場で書き起こすと少しずつ違う形が増えるため（test/design-rules.test.ts で止める）
 */

/** 指で押しやすいよう、スマホでは高さ 40px。広い画面では 36px */
const BUTTON_BASE =
  'inline-flex h-10 w-fit shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold whitespace-nowrap transition duration-150 active:scale-95 disabled:opacity-50 disabled:active:scale-100 sm:h-9';

export const ui = {
  /** 主な操作（フォローする・保存・配信を始める）。差し色で塗る */
  primaryButton: `${BUTTON_BASE} bg-accent-fill text-white hover:brightness-110`,
  /** ほかの操作（フォロー中・配信する・通報する） */
  tonalButton: `${BUTTON_BASE} bg-surface-hover hover:brightness-95 dark:hover:brightness-125`,
  /** ログインしていない人へのログイン（上の帯の右）。主な操作と同じ塗り */
  signInButton: `${BUTTON_BASE} bg-accent-fill text-white hover:brightness-110`,
  /** 文の中の小さな操作（ブロック・変える） */
  textButton: 'text-sm text-muted transition-colors hover:text-foreground',
  /** 1行の入力欄。iPhone は 16px より小さい字の入力欄に触れると画面を拡大するので、スマホでは 16px */
  input:
    'h-10 min-w-0 rounded-full border border-line bg-background px-4 text-base outline-none transition-colors focus:border-accent sm:h-9 sm:text-sm',
  /** 複数行の入力欄（禁止語）。1行の入力欄と同じ縁と字の大きさ */
  textarea:
    'min-h-24 min-w-0 rounded-2xl border border-line bg-background px-4 py-2 text-base outline-none transition-colors focus:border-accent sm:text-sm',
  /** 上の帯。画面の幅いっぱいで、下に細い線。地を少し透かす */
  headerBar: 'border-b border-line bg-background/85 backdrop-blur-md',
  /** 囲む枠（コメント・通報の理由） */
  panel: 'rounded-2xl bg-surface',
  /** 設定や配信の準備の1つのまとまり */
  card: 'flex flex-col gap-3 rounded-2xl bg-surface p-5',
  /** 配信の一覧の1枚の絵の枠 */
  thumbnail: 'relative aspect-video overflow-hidden rounded-xl bg-surface',
  /** 見出し（ページ） */
  heading: 'text-2xl font-bold tracking-tight sm:text-3xl',
  /** 見出し（まとまり） */
  subheading: 'font-bold',
  /** 文の中のリンク */
  link: 'text-accent hover:underline',
  /** チェックボックスとラジオボタン */
  check: 'size-4 accent-accent-fill',
  /** 補いの文（時刻・状態） */
  note: 'text-sm text-muted',
  /** 映像の黒い枠（上限の知らせ・ブラウザの配信）。映像は端末の明るさに関係なく黒地に白 */
  videoFrame: 'relative aspect-video w-full overflow-hidden rounded-2xl bg-black',
  /** 見る画面の映像の枠。スマホでは画面の端まで広げ、角を丸めない（YouTube のアプリと同じ） */
  watchFrame: 'relative aspect-video w-full overflow-hidden bg-black sm:rounded-2xl',
  /** 映像の枠の真ん中に出す知らせ */
  videoMessage:
    'pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-white/80',
  /** 配信中の札。差し色で塗る */
  liveTag:
    'inline-flex items-center gap-1 rounded-md bg-live px-1.5 py-0.5 text-xs font-bold text-white',
  /** 一瞬だけ出す知らせ（src/components/toaster.tsx）。設定のまとまりと同じ面に細い縁 */
  toast:
    'flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-bold text-foreground',
  /** 失敗の理由 */
  error: 'text-sm text-danger',
  /** 配信中の画面。映像を画面いっぱいに出し、上の帯にも重ねる（YouTube のアプリの配信と同じ） */
  liveScreen: 'fixed inset-0 z-50 flex h-dvh flex-col bg-black text-white',
  /** 配信中の画面の上に重ねるボタン。映像の明るさに関係なく読めるよう、黒を透かした地に白 */
  overlayButton: `${BUTTON_BASE} bg-black/50 text-white backdrop-blur-md hover:bg-black/70`,
  /** 配信中の画面の上に重ねるコメント。映像が見えるよう地を塗らず、字に影を付ける */
  overlayComments: 'text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.8)]',
  /** 配信中の画面の上に重ねるコメントの名前 */
  overlayName: 'text-white/70',
  /** 配信中の画面の上に重ねる、文の中の小さな操作（ブロック） */
  overlayTextButton: 'text-sm text-white/70 transition-colors hover:text-white',
  /** 配信中の画面の上に重ねる囲み（BGM の一覧） */
  overlayPanel: 'rounded-2xl bg-black/60 p-3 text-white backdrop-blur-md',
  /** 音量のつまみ */
  range: 'h-10 w-full min-w-0 accent-accent-fill sm:h-9',
  /** BGM の一覧の1曲 */
  bgmTrack:
    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover',
  /** BGM の一覧の流れている曲 */
  bgmTrackPlaying:
    'flex w-full items-center justify-between gap-2 rounded-lg bg-surface-hover px-3 py-2 text-left text-sm font-bold',
  /** 配信中の画面に重ねる BGM の一覧の1曲 */
  overlayBgmTrack:
    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/10',
  /** 配信中の画面に重ねる BGM の一覧の流れている曲 */
  overlayBgmTrackPlaying:
    'flex w-full items-center justify-between gap-2 rounded-lg bg-white/15 px-3 py-2 text-left text-sm font-bold text-white',
  /** 配信中の画面の上に重ねるコメントの書く欄 */
  overlayInput:
    'h-10 min-w-0 rounded-full border border-white/30 bg-black/40 px-4 text-base text-white outline-none placeholder:text-white/60 focus:border-white/70 sm:h-9 sm:text-sm',
} as const;

/** 画像で配信するときの映像の色（src/lib/still-image.ts）。見る画面の映像の枠と同じ黒地に白 */
export const stillImageColors = { background: 'black', text: 'white' } as const;
