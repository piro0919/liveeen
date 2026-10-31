import 'server-only';
import { cache } from 'react';
import { db } from './db';

/**
 * その人の名前（db/migrations/0005_profile.sql）。まだ付けていなければ null。
 * 上の帯とページの両方が聞くので、1回の表示では1度だけ引く
 */
export const displayNameOf = cache(async (userId: string): Promise<string | null> => {
  const { rows } = await db().query<{ displayName: string }>(
    'select display_name as "displayName" from profile where user_id = $1',
    [userId],
  );
  return rows[0]?.displayName ?? null;
});

/** 名前を付ける。付けてあれば変える。name は src/lib/display-name.ts で確かめたもの */
export async function setDisplayName(userId: string, name: string): Promise<void> {
  await db().query(
    `insert into profile (user_id, display_name) values ($1, $2)
     on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now()`,
    [userId, name],
  );
}

/** その人のハンドル（db/migrations/0012_handle.sql）。まだ選んでいなければ null */
export async function handleOf(userId: string): Promise<string | null> {
  const { rows } = await db().query<{ handle: string | null }>(
    'select handle from profile where user_id = $1',
    [userId],
  );
  return rows[0]?.handle ?? null;
}

/** 表の重なりの決まり（unique）に当たったときの Postgres の番号 */
const UNIQUE_VIOLATION = '23505';

/**
 * ハンドルを選ぶ。選んであれば変える（前の /@ハンドル は切れる）。handle は src/lib/handle.ts で確かめたもの。
 * ほかの人が使っていれば 'taken'。名前より後に聞くので、profile の行はもうある
 */
export async function setHandle(userId: string, handle: string): Promise<'saved' | 'taken'> {
  try {
    const { rowCount } = await db().query('update profile set handle = $2 where user_id = $1', [
      userId,
      handle,
    ]);
    if (rowCount !== 1) throw new Error('名前より先にハンドルは選べません');
    return 'saved';
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) return 'taken';
    throw error;
  }
}
