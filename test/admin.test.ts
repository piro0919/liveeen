import { describe, expect, it } from 'vitest';
import { isAdminEmail } from '@/lib/admin-emails';
import { kickPath } from '@/lib/kick';

describe('isAdminEmail', () => {
  it('カンマ区切りのどれかと、大文字小文字を問わず一致すれば運営', () => {
    expect(isAdminEmail('a@example.com, Owner@Example.com', 'owner@example.com')).toBe(true);
  });

  it('無い・空・部分一致は運営でない', () => {
    expect(isAdminEmail(undefined, 'owner@example.com')).toBe(false);
    expect(isAdminEmail('', '')).toBe(false);
    expect(isAdminEmail('a@example.com,', '')).toBe(false);
    expect(isAdminEmail('owner@example.com', 'owner@example.co')).toBe(false);
  });
});

describe('kickPath', () => {
  it('RTMP と WebRTC のつなぎは、それぞれの切る住所になる', () => {
    expect(kickPath({ type: 'rtmpConn', id: 'x' })).toBe('/v3/rtmpconns/kick/x');
    expect(kickPath({ type: 'webRTCSession', id: 'y' })).toBe('/v3/webrtcsessions/kick/y');
  });

  it('知らない種類は null', () => {
    expect(kickPath({ type: 'rtspSession', id: 'z' })).toBeNull();
  });
});
