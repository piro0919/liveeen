import { describe, expect, it } from 'vitest';
import { liveStartedMessage, subscriptionGone } from '@/lib/push-message';

describe('liveStartedMessage', () => {
  it('配信者の名前と、その配信の住所を入れる', () => {
    expect(liveStartedMessage('abc123', 'テスト配信者')).toEqual({
      title: 'テスト配信者 さんが配信を始めました',
      body: 'タップして見る',
      url: '/abc123',
    });
  });

  it('名前の無いチャンネルは id を名前の代わりにする', () => {
    expect(liveStartedMessage('abc123', null).title).toBe('abc123 さんが配信を始めました');
  });
});

describe('subscriptionGone', () => {
  it('404 と 410 は使えなくなった送り口として扱う', () => {
    expect(subscriptionGone(404)).toBe(true);
    expect(subscriptionGone(410)).toBe(true);
  });

  it('混み合いや一時的な失敗では送り口を消さない', () => {
    expect(subscriptionGone(429)).toBe(false);
    expect(subscriptionGone(500)).toBe(false);
  });
});
