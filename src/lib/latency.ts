/** 遅延の選び方（db/migrations/0004_latency_mode.sql）。hls：遅れるが軽い。low：低遅延（WebRTC） */
const LATENCY_MODES = ['hls', 'low'] as const;

export type LatencyMode = (typeof LATENCY_MODES)[number];

export function isLatencyMode(value: unknown): value is LatencyMode {
  return LATENCY_MODES.includes(value as LatencyMode);
}
