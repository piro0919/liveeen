/**
 * 配信者が決めるコメントの決まり（CLAUDE.md の Comment moderation）。
 * DB（channel）に持ち、札に入れて中継へ渡す（中継は DB を持たない）。変えたときはサイトが中継へ送り、その場で効かせる。
 * at は決まりを変えた時刻。中継は新しいほうを使う
 */
export type CommentSettings = {
  /** 1人が続けて書ける間隔（秒）。0 は低速モードなし */
  slowSeconds: number;
  /** 含むコメントをほかの人に流さない言葉。整えたもの（normalizeWord） */
  blockedWords: string[];
  /** フォローしている人だけ書ける。フォローしてからこの分数がたった人だけ。null は誰でも */
  followersOnlyMinutes: number | null;
  at: number;
};

export const NO_RULES: CommentSettings = {
  slowSeconds: 0,
  blockedWords: [],
  followersOnlyMinutes: null,
  at: 0,
};

/** 選べる値（仮に決めた）。秒と分 */
const CHOICE = { none: 0, short: 5, medium: 10, long: 30, minute: 60 } as const;

/** 低速モードで選べる間隔（秒）。0 はなし */
export const SLOW_MODE_CHOICES = [
  CHOICE.none,
  CHOICE.short,
  CHOICE.medium,
  CHOICE.long,
  CHOICE.minute,
] as const;
/** フォロワー限定で選べる、フォローしてからの分数。null は誰でも、0 はフォローしてすぐ */
export const FOLLOWERS_ONLY_CHOICES = [null, CHOICE.none, CHOICE.medium] as const;

const MS_PER_MINUTE = 60_000;

/** 禁止語の数と長さの上限（仮に決めた）。札に入れて住所で運ぶので、増やしすぎない */
export const BLOCKED_WORDS_MAX = 50;
export const BLOCKED_WORD_LENGTH_MAX = 30;

const graphemes = new Intl.Segmenter('ja', { granularity: 'grapheme' });

/** 比べる形にそろえる。全角と半角、大文字と小文字を同じに見る */
function normalizeWord(input: string): string {
  return input.normalize('NFKC').toLowerCase().trim();
}

/**
 * 配信者が1行に1つずつ入れた禁止語を整える。空の行と重なりは落とす。
 * 多すぎる・長すぎるときは理由の鍵を返す（文言は messages/ja.json の commentRules.errors）
 */
export function parseBlockedWords(
  input: string,
): { ok: true; words: string[] } | { ok: false; error: 'tooManyWords' | 'wordTooLong' } {
  const words = [...new Set(input.split(/\r?\n/).map(normalizeWord))].filter((word) => word !== '');
  if (words.length > BLOCKED_WORDS_MAX) return { ok: false, error: 'tooManyWords' };
  const long = words.find((word) => [...graphemes.segment(word)].length > BLOCKED_WORD_LENGTH_MAX);
  if (long) return { ok: false, error: 'wordTooLong' };
  return { ok: true, words };
}

/** コメントが禁止語を含むか */
export function hasBlockedWord(text: string, words: readonly string[]): boolean {
  if (words.length === 0) return false;
  const normalized = normalizeWord(text);
  return words.some((word) => normalized.includes(word));
}

/**
 * フォロワー限定で、その人が書けるか。followedAt はフォローした時刻（していなければ null）
 */
export function followerMayWrite(
  settings: CommentSettings,
  followedAt: number | null,
  now: number,
): boolean {
  const minutes = settings.followersOnlyMinutes;
  if (minutes === null) return true;
  return followedAt !== null && now - followedAt >= minutes * MS_PER_MINUTE;
}
