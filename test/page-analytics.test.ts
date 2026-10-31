import { describe, expect, it } from 'vitest';
import { redactAnalyticsEvent } from '@/components/page-analytics';

describe('閲覧数の集計に送るもの', () => {
  it('問い合わせの文字列を落とす', () => {
    expect(
      redactAnalyticsEvent({ type: 'pageview', url: 'https://liveeen.kkweb.io/settings?token=abc' })
        .url,
    ).toBe('https://liveeen.kkweb.io/settings');
  });

  it('問い合わせの無い住所はそのまま', () => {
    expect(
      redactAnalyticsEvent({ type: 'pageview', url: 'https://liveeen.kkweb.io/@piro0919' }).url,
    ).toBe('https://liveeen.kkweb.io/@piro0919');
  });
});
