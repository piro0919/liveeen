/** 通報の理由。並びは選ぶ画面に出す順。値は db/migrations/0013_report_reason.sql と同じ */
export const REPORT_REASONS = [
  { value: 'sexual', label: '性的な内容' },
  { value: 'violence', label: '暴力・危険な行為' },
  { value: 'harassment', label: '嫌がらせ・差別' },
  { value: 'other', label: 'その他' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

export function isReportReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.some((reason) => reason.value === value);
}

/**
 * 理由ごとの件数を、管理画面に出す言葉にする（「性的な内容 2・その他 1」）。並びは REPORT_REASONS の順。
 * 理由を聞く前の通報は「理由なし」
 */
export function reasonSummary(counts: ReadonlyMap<ReportReason | null, number>): string {
  const parts: string[] = REPORT_REASONS.flatMap((reason) => {
    const count = counts.get(reason.value) ?? 0;
    return count > 0 ? [`${reason.label} ${count}`] : [];
  });
  const unknown = counts.get(null) ?? 0;
  if (unknown > 0) parts.push(`理由なし ${unknown}`);
  return parts.join('・');
}
