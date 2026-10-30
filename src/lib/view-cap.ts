import { z } from 'zod';

/** 月の上限（CLAUDE.md の Cost）。届いたら新しい視聴を通さない */
export const VIEW_CAP_YEN = 50_000;

/** Akamai の東京・大阪で、転送量の枠を超えた分の値段（CLAUDE.md の Cost の表） */
export const TRANSFER_USD_PER_GB = 0.005;

/**
 * Akamai の API の転送量（GET /v4/account/transfer）のうち、使うところだけ。単位は GB。
 * billable は今月の枠を超えて課金される分。形は https://techdocs.akamai.com/linode-api/reference/get-transfer
 */
const transfer = z.object({
  billable: z.number(),
  region_transfers: z.array(z.object({ id: z.string(), billable: z.number() })).default([]),
});

/**
 * 課金される転送量（GB）。region を渡すと、その地域の分を読む（新しい地域は全体と別の枠で数える）。
 * 形が合わないか、その地域が無ければ null
 */
export function billableGbOf(body: unknown, region: string | undefined): number | null {
  const parsed = transfer.safeParse(body);
  if (!parsed.success) return null;
  if (!region) return parsed.data.billable;
  return parsed.data.region_transfers.find((entry) => entry.id === region)?.billable ?? null;
}

export type CostInputs = {
  billableGb: number;
  /** 配信サーバーの月の料金（ドル） */
  serverFeeUsd: number;
  yenPerUsd: number;
};

/** 今月の配信の費用（円）。サーバーの月の料金と、枠を超えた転送量の分 */
export function monthlyCostYen({ billableGb, serverFeeUsd, yenPerUsd }: CostInputs): number {
  return (serverFeeUsd + billableGb * TRANSFER_USD_PER_GB) * yenPerUsd;
}

/** 今月の費用が上限に届いたか */
export function viewCapReached(inputs: CostInputs): boolean {
  return monthlyCostYen(inputs) >= VIEW_CAP_YEN;
}
