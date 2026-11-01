import 'server-only';
import { waitUntil } from '@vercel/functions';
import { db } from './db';
import { billableGbOf, viewCapReached } from './view-cap';
import { env } from '@/env';

const TRANSFER_API_URL = 'https://api.linode.com/v4/account/transfer';
/** Akamai が答えないとき、視聴の確かめを待たせる上限 */
const API_TIMEOUT_MS = 3000;
/** 読んだ転送量を使い回す長さ。これより古ければ読み直す */
const FRESH_MS = 300_000;
/** Akamai が答えなかったとき、次に聞くまでの間。毎回 3 秒待たせない */
const RETRY_MS = 60_000;

/** この関数の実体が知っている転送量。視聴の確かめのたびに DB を読むと Neon が止まらないので、手元に持つ */
let known: { gb: number | null; until: number } | null = null;
/** この関数の実体が DB に覚えた値 */
let savedGb: number | null = null;

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
 * Akamai が答えないときのために DB に覚える。変わったときだけ書く。
 * 課金が無いあいだは書かない（DB を起こさない。覚えた値は月が変われば使わないので、消さなくてよい）
 */
async function saveBillableGb(gb: number): Promise<void> {
  if (gb === (savedGb ?? 0)) return;
  await db()
    .query(
      `insert into transfer_usage (billable_gb, fetched_at) values ($1, now())
       on conflict (id) do update set billable_gb = excluded.billable_gb, fetched_at = excluded.fetched_at`,
      [gb],
    )
    .then(() => {
      savedGb = gb;
    })
    .catch(() => undefined);
}

/** 今月 DB に覚えた転送量。先月の値は、Akamai の数え直しで意味を失うので使わない */
async function savedBillableGb(): Promise<number | null> {
  const result = await db()
    .query<{ billableGb: number }>(
      `select billable_gb as "billableGb" from transfer_usage
       where date_trunc('month', fetched_at at time zone 'utc') = date_trunc('month', now() at time zone 'utc')`,
    )
    .catch(() => null);
  return result?.rows[0]?.billableGb ?? null;
}

/**
 * 今月の課金される転送量（GB）。Akamai を正とし、5分は手元の値を使う。
 * 読めなければ手元の値か DB に覚えた値を使う。どれも無ければ null
 */
async function billableGb(token: string): Promise<number | null> {
  const now = Date.now();
  if (known && now < known.until) return known.gb;
  const fetched = await fetchBillableGb(token);
  if (fetched !== null) {
    known = { gb: fetched, until: now + FRESH_MS };
    // 視聴の確かめを、眠っている DB の起動で待たせない
    waitUntil(saveBillableGb(fetched));
    return fetched;
  }
  const gb = known?.gb ?? (await savedBillableGb());
  known = { gb, until: now + RETRY_MS };
  return gb;
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
