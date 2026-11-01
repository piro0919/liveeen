const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const DAYS_IN_MONTH = 30;
const DAYS_IN_YEAR = 365;

/**
 * 日本語の相対時刻（3日前）。「昨日」は使わない。経った時間で切るので、47時間前の「1日前」が一昨日でも嘘にならないように。
 * 時計のずれで未来や1分未満になっても「1分前」で止める
 */
const format = new Intl.RelativeTimeFormat('ja', { numeric: 'always' });

function pick(elapsedMs: number): [number, Intl.RelativeTimeFormatUnit] {
  if (elapsedMs < HOUR_MS) return [Math.max(1, Math.floor(elapsedMs / MINUTE_MS)), 'minute'];
  if (elapsedMs < DAY_MS) return [Math.floor(elapsedMs / HOUR_MS), 'hour'];
  const days = Math.floor(elapsedMs / DAY_MS);
  if (days < DAYS_IN_MONTH) return [days, 'day'];
  if (days < DAYS_IN_YEAR) return [Math.floor(days / DAYS_IN_MONTH), 'month'];
  return [Math.floor(days / DAYS_IN_YEAR), 'year'];
}

/** その時刻が今からどれだけ前か。Intl は「3 日前」と数の後ろに空白を入れるので除く */
export function timeAgo(at: number, now: number = Date.now()): string {
  const [amount, unit] = pick(now - at);
  return format.format(-amount, unit).replaceAll(' ', '');
}
