import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAccount } from '@/lib/account';
import { addChannel, addUser, query, reset } from './seed';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

beforeEach(reset);

/** user を指す外部キー。表を足したら、ここに自動で入る */
function foreignKeysToUser() {
  return query<{ table: string; onDelete: string }>(
    `select conrelid::regclass::text as table, confdeltype as "onDelete"
       from pg_constraint
      where contype = 'f' and confrelid = '"user"'::regclass
      order by 1`,
  );
}

/** ある人の行を、user を指す表の主なものに入れる */
async function seedEverything(userId: string, otherChannel: string): Promise<void> {
  await query('insert into follow (user_id, channel_id) values ($1, $2)', [userId, otherChannel]);
  await query('insert into notification_setting (user_id) values ($1)', [userId]);
  await query(
    `insert into report (channel_id, stream_started_at, user_id) values ($1, now(), $2)`,
    [otherChannel, userId],
  );
  await query(
    `insert into push_subscription (endpoint, user_id, p256dh, auth) values ($1, $2, 'p', 'a')`,
    [`https://push.example/${userId}`, userId],
  );
  await query('insert into channel_moderator (channel_id, user_id) values ($1, $2)', [
    otherChannel,
    userId,
  ]);
  await query(`insert into avatar (user_id, choice) values ($1, 'initial')`, [userId]);
  await query(`insert into action_log (user_id, action) values ($1, 'avatarUpload')`, [userId]);
}

describe('user を指す表', () => {
  it('どれも on delete cascade（/privacy は消すと一緒に消えると約束している）', async () => {
    const keys = await foreignKeysToUser();
    expect(keys.length).toBeGreaterThanOrEqual(13);
    expect(keys.filter((key) => key.onDelete !== 'c')).toEqual([]);
  });
});

describe('deleteAccount', () => {
  it('その人の行をどの表からも消し、ほかの人の行は残す', async () => {
    const leaving = await addUser();
    const channelId = await addChannel(leaving);
    const staying = await addUser();
    const otherChannel = await addChannel(staying);
    await seedEverything(leaving, otherChannel);
    await seedEverything(staying, channelId);

    expect(await deleteAccount(leaving)).toEqual({ deleted: true, channelId });

    const keys = await foreignKeysToUser();
    for (const { table } of keys) {
      const column = table === 'session' || table === 'account' ? '"userId"' : 'user_id';
      const [left] = await query<{ n: number }>(
        `select count(*)::int as n from ${table} where ${column} = $1`,
        [leaving],
      );
      expect(left?.n, table).toBe(0);
    }
    expect(await query('select 1 from channel where id = $1', [channelId])).toHaveLength(0);
    expect(await query('select 1 from channel where id = $1', [otherChannel])).toHaveLength(1);
    expect(await query('select 1 from "user" where id = $1', [staying])).toHaveLength(1);
    // 消えたチャンネルへのフォローは消え、残ったチャンネルの行は残る
    expect(
      await query('select 1 from push_subscription where user_id = $1', [staying]),
    ).toHaveLength(1);
  });

  it('運営に止められた配信者は消せず、何も変わらない', async () => {
    const banned = await addUser();
    const channelId = await addChannel(banned);
    await query('update channel set banned_at = now() where id = $1', [channelId]);
    expect(await deleteAccount(banned)).toEqual({ deleted: false });
    expect(await query('select 1 from "user" where id = $1', [banned])).toHaveLength(1);
  });

  it('IP のブロックは残し、id だけのブロックは消す', async () => {
    const streamer = await addUser();
    const channelId = await addChannel(streamer);
    const blocked = await addUser();
    await query(
      `insert into comment_block (channel_id, user_id, ip_key, display_name)
       values ($1, $2, 'ip-a', 'あ'), ($1, $2, null, 'い')`,
      [channelId, blocked],
    );
    await deleteAccount(blocked);
    const left = await query<{ user_id: string | null; ip_key: string | null }>(
      'select user_id, ip_key from comment_block where channel_id = $1',
      [channelId],
    );
    expect(left).toEqual([{ user_id: null, ip_key: 'ip-a' }]);
  });
});
