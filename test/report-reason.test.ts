import { describe, expect, it } from 'vitest';
import { isReportReason, reasonSummary, type ReportReason } from '@/lib/report-reason';

describe('isReportReason', () => {
  it('決まった理由だけを通す', () => {
    expect(isReportReason('sexual')).toBe(true);
    expect(isReportReason('other')).toBe(true);
    expect(isReportReason('spam')).toBe(false);
    expect(isReportReason(null)).toBe(false);
  });
});

describe('reasonSummary', () => {
  it('理由の並びの順に、件数のあるものだけを出す', () => {
    const counts = new Map<ReportReason | null, number>([
      ['other', 1],
      ['sexual', 2],
    ]);
    expect(reasonSummary(counts)).toBe('性的な内容 2・その他 1');
  });

  it('理由を聞く前の通報は最後に「理由なし」', () => {
    const counts = new Map<ReportReason | null, number>([
      [null, 1],
      ['harassment', 1],
    ]);
    expect(reasonSummary(counts)).toBe('嫌がらせ・差別 1・理由なし 1');
  });

  it('通報が無ければ空', () => {
    expect(reasonSummary(new Map())).toBe('');
  });
});
