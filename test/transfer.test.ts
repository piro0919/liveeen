import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 今月の転送量の読み方。視聴の確かめは配信していない画面からも5秒ごとに届くので、
 * そのたびに DB を読むと Neon が止まらず、無料枠を使い切る（CLAUDE.md の月の上限）
 */

const query = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>();
vi.mock('@/lib/db', () => ({ db: () => ({ query }) }));
vi.mock('@/env', () => ({
  env: { AKAMAI_API_TOKEN: 'token', MEDIA_SERVER_FEE_USD: 5, YEN_PER_USD: 165 },
}));

const MINUTE_MS = 60_000;
/** ¥50,000 を超える転送量 */
const OVER_CAP_GB = 100_000;

const akamai = vi.fn<() => Promise<Response>>();

function answers(billable: number) {
  return Promise.resolve(Response.json({ billable, used: 0, quota: 0, region_transfers: [] }));
}

async function load() {
  vi.resetModules();
  return (await import('@/lib/transfer')).viewingCapReached;
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-15T00:00:00Z') });
  query.mockReset();
  query.mockResolvedValue({ rows: [] });
  akamai.mockReset();
  vi.stubGlobal('fetch', akamai);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('viewingCapReached', () => {
  it('何度聞かれても5分の間は DB にも Akamai にも行かない', async () => {
    akamai.mockImplementation(() => answers(0));
    const reached = await load();
    for (let i = 0; i < 50; i += 1) {
      expect(await reached()).toBe(false);
      await vi.advanceTimersByTimeAsync(5000);
    }
    expect(akamai).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
  });

  it('5分たったら Akamai を読み直すが、課金が無いままなら DB には行かない', async () => {
    akamai.mockImplementation(() => answers(0));
    const reached = await load();
    await reached();
    await vi.advanceTimersByTimeAsync(5 * MINUTE_MS + 1);
    await reached();
    expect(akamai).toHaveBeenCalledTimes(2);
    expect(query).not.toHaveBeenCalled();
  });

  it('上限を超えたら断り、値が変わったときだけ覚える', async () => {
    akamai.mockImplementation(() => answers(OVER_CAP_GB));
    const reached = await load();
    expect(await reached()).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual([OVER_CAP_GB]);
    await vi.advanceTimersByTimeAsync(5 * MINUTE_MS + 1);
    expect(await reached()).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('Akamai が答えなければ、今月 DB に覚えた値を使い、1分は聞き直さない', async () => {
    akamai.mockImplementation(() => Promise.reject(new Error('down')));
    query.mockResolvedValue({ rows: [{ billableGb: OVER_CAP_GB }] });
    const reached = await load();
    expect(await reached()).toBe(true);
    expect(query.mock.calls[0]?.[0]).toContain('date_trunc');
    expect(await reached()).toBe(true);
    expect(akamai).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(MINUTE_MS + 1);
    await reached();
    expect(akamai).toHaveBeenCalledTimes(2);
  });

  it('どちらも読めなければ、上限は当てない', async () => {
    akamai.mockImplementation(() => Promise.reject(new Error('down')));
    query.mockRejectedValue(new Error('db down'));
    expect(await (await load())()).toBe(false);
  });

  it('DB に覚えられなくても、Akamai の値で判断する', async () => {
    akamai.mockImplementation(() => answers(OVER_CAP_GB));
    query.mockRejectedValue(new Error('db down'));
    expect(await (await load())()).toBe(true);
  });
});
