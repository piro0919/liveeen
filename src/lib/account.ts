import 'server-only';
import { cookies } from 'next/headers';
import { db } from './db';

/**
 * アカウントを消す（/settings）。結びついた情報は DB の on delete cascade で一緒に消える。
 * 運営に止められた配信者は消せない。消して作り直すと、止めたことが外れるため（問い合わせで受ける）。
 * ブロックされた人が消しても、IP のブロックは残す。消すと id の列ごと行が消え、作り直せば書けてしまうため。
 * 消したチャンネルの id を返す。配信中なら呼んだ側が切る
 */
export async function deleteAccount(
  userId: string,
): Promise<{ deleted: true; channelId: string | null } | { deleted: false }> {
  const client = await db().connect();
  try {
    await client.query('begin');
    const { rows } = await client.query<{ id: string; bannedAt: Date | null }>(
      'select id, banned_at as "bannedAt" from channel where user_id = $1 for update',
      [userId],
    );
    const channel = rows[0] ?? null;
    if (channel?.bannedAt) {
      await client.query('rollback');
      return { deleted: false };
    }
    await client.query(
      'update comment_block set user_id = null where user_id = $1 and ip_key is not null',
      [userId],
    );
    await client.query('delete from "user" where id = $1', [userId]);
    await client.query('commit');
    return { deleted: true, channelId: channel?.id ?? null };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * ログインのクッキーを消す。セッションの行は消えても、控え（cookieCache）が5分残るため。
 * 本番では名前に __Secure- が付く。その名前のクッキーは Secure を付けて書かないとブラウザが受け取らず、消えない
 */
export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  for (const { name } of jar.getAll()) {
    const secure = name.startsWith('__Secure-better-auth.');
    if (secure || name.startsWith('better-auth.')) jar.delete({ name, path: '/', secure });
  }
}
