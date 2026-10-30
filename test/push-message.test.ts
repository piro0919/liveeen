import { describe, expect, it } from 'vitest';
import { liveStartedMessage, subscriptionGone } from '@/lib/push-message';

describe('liveStartedMessage', () => {
  it('配信者の名前と、その配信の住所（/@ハンドル）を入れる', () => {
    expect(
      liveStartedMessage({ channelId: 'abc123', displayName: 'テスト配信者', handle: 'piro' }),
    ).toEqual({
      title: 'テスト配信者 さんが配信を始めました',
      body: 'タップして見る',
      url: '/@piro',
    });
  });

  it('ハンドルがまだ無ければ、住所はチャンネルの id', () => {
    expect(
      liveStartedMessage({ channelId: 'abc123', displayName: 'テスト配信者', handle: null }).url,
    ).toBe('/abc123');
  });

  it('名前の無いチャンネルは id を名前の代わりにする', () => {
    expect(liveStartedMessage({ channelId: 'abc123', displayName: null, handle: null }).title).toBe(
      'abc123 さんが配信を始めました',
    );
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
