import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { testUrl } from './urls';

/**
 * 待機中の接続が切れても落ちない。Neon は眠るときに接続を閉じる。pool に error の受け手が無いと、
 * 待機中の接続の切断が受け止められない例外になり、関数ごと落ちる
 */
describe('db', () => {
  it('待機中の接続が切られても、例外にならず次の問い合わせができる', async () => {
    const pool = db();
    const client = await pool.connect();
    const { rows } = await client.query<{ pid: number }>('select pg_backend_pid() as pid');
    client.release();
    // pool の接続で頼むと、切られる接続自身が頼むことになるので、別につなぐ
    const killer = new pg.Client({ connectionString: testUrl });
    await killer.connect();
    await killer.query('select pg_terminate_backend($1)', [rows[0]?.pid]);
    await killer.end();
    // ここで受け手を足すと、受け手の無い実装でも通ってしまうので、切れたことは数で見る
    while (pool.totalCount > 0) await new Promise((resolve) => setTimeout(resolve, 10));
    const after = await pool.query<{ one: number }>('select 1 as one');
    expect(after.rows[0]?.one).toBe(1);
  });
});
