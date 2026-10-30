import { describe, expect, it } from 'vitest';
import {
  billableGbOf,
  monthlyCostYen,
  TRANSFER_USD_PER_GB,
  VIEW_CAP_YEN,
  viewCapReached,
} from '@/lib/view-cap';

const YEN_PER_USD = 150;
const SERVER_FEE_USD = 100;
/** サーバーの料金と合わせて、ちょうど上限になる転送量 */
const CAP_GB = (VIEW_CAP_YEN / YEN_PER_USD - SERVER_FEE_USD) / TRANSFER_USD_PER_GB;

describe('billableGbOf', () => {
  const body = {
    billable: 12,
    quota: 1000,
    used: 1012,
    region_transfers: [{ id: 'jp-tyo-3', billable: 34, quota: 500, used: 534 }],
  };

  it('地域を渡さなければ全体の分を読む', () => {
    expect(billableGbOf(body, undefined)).toBe(12);
  });

  it('地域を渡せばその地域の分を読む', () => {
    expect(billableGbOf(body, 'jp-tyo-3')).toBe(34);
  });

  it('その地域が無いか、形が合わなければ null', () => {
    expect(billableGbOf(body, 'jp-osa')).toBeNull();
    expect(billableGbOf({ used: 1 }, undefined)).toBeNull();
    expect(billableGbOf(null, undefined)).toBeNull();
  });
});

describe('viewCapReached', () => {
  it('サーバーの料金と、枠を超えた転送量の分を足して円にする', () => {
    expect(monthlyCostYen({ billableGb: 1000, serverFeeUsd: 10, yenPerUsd: 150 })).toBe(
      (10 + 1000 * TRANSFER_USD_PER_GB) * 150,
    );
  });

  it('上限にちょうど届いたら届いたとし、その手前は届いていない', () => {
    const inputs = { serverFeeUsd: SERVER_FEE_USD, yenPerUsd: YEN_PER_USD };
    expect(viewCapReached({ ...inputs, billableGb: CAP_GB })).toBe(true);
    expect(viewCapReached({ ...inputs, billableGb: CAP_GB - 1 })).toBe(false);
  });
});
