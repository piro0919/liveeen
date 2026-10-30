import 'server-only';
import { db } from './db';
import { billableGbOf, viewCapReached } from './view-cap';
import { env } from '@/env';

const TRANSFER_API_URL = 'https://api.linode.com/v4/account/transfer';
/** Akamai が答えないとき、視聴の確かめを待たせる上限 */
const API_TIMEOUT_MS = 3000;
/** 読んだ転送量を使い回す長さ。これより古ければ読み直す */
const FRESH_MS = 300_000;

/** Akamai の API から、今月の課金される転送量（GB）を読む。答えなければ null */
async function fetchBillableGb(token: string): Promise<number | null> {
  const response = await fetch(TRANSFER_API_URL, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  }).catch(() => null);
  if (!response?.ok) return null;
  return billableGbOf(await response.json().catch(() => null), env.AKAMAI_REGION);
}

/**
 * 今月の課金される転送量（GB）。DB に覚えた値が新しければそれを、古ければ読み直して覚える。
 * 読み直せなければ古い値を使う。一度も読めていなければ null
 */
async function billableGb(token: string): Promise<number | null> {
  const { rows } = await db().query<{ billableGb: number; fetchedAt: Date }>(
    'select billable_gb as "billableGb", fetched_at as "fetchedAt" from transfer_usage',
  );
  const saved = rows[0];
  if (saved && Date.now() - saved.fetchedAt.getTime() < FRESH_MS) return saved.billableGb;
  const fetched = await fetchBillableGb(token);
  if (fetched === null) return saved?.billableGb ?? null;
  await db().query(
    `insert into transfer_usage (billable_gb, fetched_at) values ($1, now())
     on conflict (id) do update set billable_gb = excluded.billable_gb, fetched_at = excluded.fetched_at`,
    [fetched],
  );
  return fetched;
}

/**
 * 今月の配信の費用が上限（src/lib/view-cap.ts）に届いたか。届いていれば新しい視聴を通さない。
 * Akamai の API の鍵・サーバーの月の料金・ドルの値段のどれかが無ければ確かめない（手元）。
 * 転送量が一度も読めていなければ、届いていないとして扱う
 */
export async function viewingCapReached(): Promise<boolean> {
  const { AKAMAI_API_TOKEN, MEDIA_SERVER_FEE_USD, YEN_PER_USD } = env;
  if (!AKAMAI_API_TOKEN || MEDIA_SERVER_FEE_USD === undefined || YEN_PER_USD === undefined) {
    return false;
  }
  const gb = await billableGb(AKAMAI_API_TOKEN);
  if (gb === null) return false;
  return viewCapReached({
    billableGb: gb,
    serverFeeUsd: MEDIA_SERVER_FEE_USD,
    yenPerUsd: YEN_PER_USD,
  });
}
