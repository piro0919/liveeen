// DB を読み書きするのはサーバーだけ
import 'server-only';
import { attachDatabasePool } from '@vercel/functions';
import pg from 'pg';
import { env } from '@/env';

/** 1つの関数の実体が同時に開く接続の上限 */
const MAX_CONNECTIONS = 3;

let pool: pg.Pool | undefined;

/**
 * サイトの DB の接続。1つの入れ物を使い回す。
 * 初めて使うときに作る。読み込みの時点で作ると、DATABASE_URL の無い型の確かめなどが落ちる。
 * 待機中の接続を Neon が閉じると pool は error を出す。受け手が無いと関数ごと落ちる（test/db/pool.test.ts）。
 * attachDatabasePool は、関数が眠る前に使っていない接続を閉じる
 */
export function db(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: MAX_CONNECTIONS });
    pool.on('error', (error) => console.error('DB の待機中の接続が切れました:', error.message));
    attachDatabasePool(pool);
  }
  return pool;
}
