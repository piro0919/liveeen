import { describe, expect, it } from 'vitest';
import { batchesOf, EMAILS_PER_BATCH, liveStartedEmails } from '@/lib/live-email';

const base = {
  channelId: 'abc123',
  siteUrl: 'https://liveeen.example',
  from: 'Liveeen <notice@liveeen.example>',
};

describe('liveStartedEmails', () => {
  it('送り先ごとに1通作り、配信と設定の住所を入れる', () => {
    const emails = liveStartedEmails({
      ...base,
      displayName: 'テスト配信者',
      to: [
        { email: 'a@example.com', unsubscribeToken: 'tok-a' },
        { email: 'b@example.com', unsubscribeToken: 'tok-b' },
      ],
    });
    expect(emails.map((email) => email.to)).toEqual(['a@example.com', 'b@example.com']);
    expect(emails[0].subject).toBe('テスト配信者 さんが配信を始めました');
    expect(emails[0].text).toContain('https://liveeen.example/abc123');
    expect(emails[0].text).toContain('https://liveeen.example/settings');
  });

  it('送り先ごとの札で、1回で止められる List-Unsubscribe を付ける（RFC 8058）', () => {
    const emails = liveStartedEmails({
      ...base,
      displayName: null,
      to: [
        { email: 'a@example.com', unsubscribeToken: 'tok-a' },
        { email: 'b@example.com', unsubscribeToken: 'tok-b' },
      ],
    });
    expect(emails.map((email) => email.headers)).toEqual([
      {
        'List-Unsubscribe': '<https://liveeen.example/api/email/unsubscribe?token=tok-a>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      {
        'List-Unsubscribe': '<https://liveeen.example/api/email/unsubscribe?token=tok-b>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    ]);
  });

  it('名前の無いチャンネルは id を名前の代わりにする', () => {
    const [email] = liveStartedEmails({
      ...base,
      displayName: null,
      to: [{ email: 'a@example.com', unsubscribeToken: 'tok-a' }],
    });
    expect(email.subject).toBe('abc123 さんが配信を始めました');
  });
});

describe('batchesOf', () => {
  it('一括送信の上限ずつに分ける', () => {
    const items = Array.from({ length: EMAILS_PER_BATCH * 2 + 1 }, (_, index) => index);
    expect(batchesOf(items).map((batch) => batch.length)).toEqual([
      EMAILS_PER_BATCH,
      EMAILS_PER_BATCH,
      1,
    ]);
  });

  it('空なら1回も送らない', () => {
    expect(batchesOf([])).toEqual([]);
  });
});
