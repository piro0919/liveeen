import { describe, expect, it } from 'vitest';
import { isLatencyMode } from '@/lib/latency';

describe('isLatencyMode', () => {
  it('hls と low だけを受け付ける（db/migrations/0004_latency_mode.sql の check と同じ）', () => {
    expect(isLatencyMode('hls')).toBe(true);
    expect(isLatencyMode('low')).toBe(true);
    expect(isLatencyMode('webrtc')).toBe(false);
    expect(isLatencyMode(undefined)).toBe(false);
  });
});
