import { describe, expect, it } from 'vitest';
import { newChannelId, newStreamKey } from '@/lib/stream-key';

describe('stream-key', () => {
  it('配信の鍵は `.` を含まない（含むものは札として扱われる）', () => {
    for (let i = 0; i < 100; i++) expect(newStreamKey()).not.toContain('.');
  });

  it('チャンネルの id は MediaMTX の名前として受け付ける形になる', () => {
    for (let i = 0; i < 100; i++) expect(newChannelId()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
