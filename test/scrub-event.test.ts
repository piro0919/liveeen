import type { ErrorEvent } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import { scrubEvent } from '@/lib/scrub-event';

/**
 * プライバシーポリシー（/privacy）で Sentry に送るのはサーバーのエラーだと書いている。
 * メールアドレス・IP・Cookie・配信の鍵・コメントを送らないのを守るのが scrubEvent
 */
describe('scrubEvent', () => {
  it('利用者・本文・クッキー・ヘッダー・問い合わせの文字列・足跡を落とし、アドレスだけ残す', () => {
    const event = scrubEvent({
      type: undefined,
      user: { id: 'u1', ip_address: '203.0.113.1', email: 'a@example.com' },
      request: {
        url: 'https://liveeen.kkweb.io/api/email/unsubscribe?token=secret',
        cookies: { 'better-auth.session_token': 'secret' },
        data: { title: '配信の題', email: 'a@example.com' },
        headers: { 'x-forwarded-for': '203.0.113.1', authorization: 'Bearer streamkey' },
        query_string: 'token=secret',
      },
      contexts: { nextjs: { request_path: '/api/email/unsubscribe?token=secret' } },
      breadcrumbs: [{ category: 'console', message: 'Failing row contains (a@example.com)' }],
    } as ErrorEvent);

    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ url: 'https://liveeen.kkweb.io/api/email/unsubscribe' });
    expect(event.contexts?.nextjs?.request_path).toBe('/api/email/unsubscribe');
    expect(event.breadcrumbs).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain('secret');
  });
});
