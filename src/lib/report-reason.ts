/**
 * 通報の理由。並びは選ぶ画面に出す順。値は db/migrations/0013_report_reason.sql と同じ。
 * 文言は messages/ja.json の reportReasons
 */
export const REPORT_REASONS = ['sexual', 'violence', 'harassment', 'other'] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export function isReportReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.some((reason) => reason === value);
}

/**
 * 理由ごとの件数を、管理画面に出す言葉にする（「性的な内容 2・その他 1」）。並びは REPORT_REASONS の順。
 * label は理由の文言。理由を聞く前の通報（null）は「理由なし」
 */
export function reasonSummary(
  counts: ReadonlyMap<ReportReason | null, number>,
  label: (reason: ReportReason | 'none') => string,
): string {
  const parts: string[] = [...REPORT_REASONS, null].flatMap((reason) => {
    const count = counts.get(reason) ?? 0;
    return count > 0 ? [`${label(reason ?? 'none')} ${count}`] : [];
  });
  return parts.join('・');
}
