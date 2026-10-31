import 'server-only';
import { z } from 'zod';
import { relayHttpUrl } from './thumbnail';

/** 中継が答えないとき、トップを待たせる上限 */
const TIMEOUT_MS = 1500;

const counts = z.record(z.string(), z.number().int().nonnegative());

/**
 * チャンネルごとの見ている人の数（relay/relay.ts の /viewers）。見る画面がコメントの中継に開いているつなぎの数で、配信者自身は数えない。
 * 中継が答えなければ空（トップは人数を出さずに開く）
 */
export async function viewerCounts(relayUrl: string): Promise<Map<string, number>> {
  try {
    const response = await fetch(relayHttpUrl(relayUrl, '/viewers'), {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return new Map();
    const parsed = counts.safeParse(await response.json());
    return parsed.success ? new Map(Object.entries(parsed.data)) : new Map();
  } catch {
    return new Map();
  }
}
