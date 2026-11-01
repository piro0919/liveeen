import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { db } from '@/lib/db';

export async function query<T extends object>(sql: string, values: unknown[] = []): Promise<T[]> {
  return (await db().query<T extends pg.QueryResultRow ? T : never>(sql, values)).rows;
}

/** 表を空にする。user と channel を指す表は cascade で一緒に空になる */
export async function reset(): Promise<void> {
  await db().query('truncate "user", channel, transfer_usage, reported_comment cascade');
}

export async function addUser(): Promise<string> {
  const id = randomUUID();
  await db().query(
    `insert into "user" (id, name, email, "emailVerified") values ($1, 'テスト', $2, true)`,
    [id, `${id}@example.invalid`],
  );
  return id;
}

export async function addChannel(
  userId: string,
  { name = '配信者', handle = null as string | null, title = null as string | null } = {},
): Promise<string> {
  const id = `chan${randomUUID().slice(0, 8)}`;
  await db().query(
    'insert into profile (user_id, display_name, handle) values ($1, $2, $3) on conflict do nothing',
    [userId, name, handle],
  );
  await db().query(
    'insert into channel (id, user_id, stream_key_hash, title) values ($1, $2, $3, $4)',
    [id, userId, randomUUID(), title],
  );
  return id;
}
