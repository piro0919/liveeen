import 'server-only';
import { db } from './db';

/** その人の名前（db/migrations/0005_profile.sql）。まだ付けていなければ null */
export async function displayNameOf(userId: string): Promise<string | null> {
  const { rows } = await db().query<{ displayName: string }>(
    'select display_name as "displayName" from profile where user_id = $1',
    [userId],
  );
  return rows[0]?.displayName ?? null;
}

/** 名前を付ける。付けてあれば変える。name は src/lib/display-name.ts で確かめたもの */
export async function setDisplayName(userId: string, name: string): Promise<void> {
  await db().query(
    `insert into profile (user_id, display_name) values ($1, $2)
     on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now()`,
    [userId, name],
  );
}
