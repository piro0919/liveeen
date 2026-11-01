import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blockCommenter, commenterBlocked } from '@/lib/blocks';
import { channelById, searchChannels } from '@/lib/channels';
import { follow, followerCount, unfollow } from '@/lib/follows';
import { streamKey } from '@/lib/delist';
import { reportComment } from '@/lib/comment-reports';
import { holdLiveNotice, notifyLiveStarted } from '@/lib/notify';
import { withinLimit } from '@/lib/rate-limit';
import { hasReported, report, reportersOf } from '@/lib/reports';
import { addChannel, addUser, query, reset } from './seed';

const sent = vi.hoisted(() => ({ pushes: vi.fn(), emails: vi.fn() }));
vi.mock('@/lib/push', () => ({ sendLivePushes: sent.pushes }));
vi.mock('@/lib/email', () => ({ sendLiveEmails: sent.emails }));

beforeEach(async () => {
  await reset();
  sent.pushes.mockReset();
  sent.emails.mockReset();
});

const AVATAR_UPLOADS_PER_HOUR = 10;

describe('withinLimit', () => {
  it('1時間に10回まで通し、数えるのは人ごと', async () => {
    const user = await addUser();
    const other = await addUser();
    for (let i = 0; i < AVATAR_UPLOADS_PER_HOUR; i += 1) {
      expect(await withinLimit(user, 'avatarUpload')).toBe(true);
    }
    expect(await withinLimit(user, 'avatarUpload')).toBe(false);
    expect(await withinLimit(other, 'avatarUpload')).toBe(true);
  });

  it('1時間より古い記録は数えず、消す', async () => {
    const user = await addUser();
    for (let i = 0; i < AVATAR_UPLOADS_PER_HOUR; i += 1) await withinLimit(user, 'avatarUpload');
    await query(`update action_log set created_at = now() - interval '61 minutes'`);
    expect(await withinLimit(user, 'avatarUpload')).toBe(true);
    const [left] = await query<{ n: number }>('select count(*)::int as n from action_log');
    expect(left?.n).toBe(1);
  });
});

describe('searchChannels', () => {
  it('名前・ハンドル・タイトルの一部で探し、大文字と小文字を区別しない', async () => {
    const id = await addChannel(await addUser(), {
      name: 'ぴろ',
      handle: 'piro_live',
      title: '雑談 Night',
    });
    for (const word of ['ぴろ', 'PIRO', 'night']) {
      expect((await searchChannels(word)).map((channel) => channel.id)).toEqual([id]);
    }
    expect(await searchChannels('無い言葉')).toEqual([]);
  });

  it('% と _ は普通の文字として探す', async () => {
    await addChannel(await addUser(), { name: 'ぴろ', handle: 'abc' });
    expect(await searchChannels('%')).toEqual([]);
    expect(await searchChannels('a_c')).toEqual([]);
  });

  it('止められたチャンネルは出さない', async () => {
    const id = await addChannel(await addUser(), { name: 'ぴろ' });
    await query('update channel set banned_at = now() where id = $1', [id]);
    expect(await searchChannels('ぴろ')).toEqual([]);
  });

  it('ハンドルがそのまま一致する人を先頭にする', async () => {
    await addChannel(await addUser(), { name: 'あ piro', handle: 'piro_two' });
    const exact = await addChannel(await addUser(), { name: 'ん', handle: 'piro' });
    expect((await searchChannels('piro'))[0]?.id).toBe(exact);
  });
});

describe('followerCount', () => {
  it('そのチャンネルをフォローしている人だけを数える', async () => {
    const [streamer, other, viewerA, viewerB] = await Promise.all([
      addUser(),
      addUser(),
      addUser(),
      addUser(),
    ]);
    const channel = await addChannel(streamer);
    const otherChannel = await addChannel(other);
    expect(await followerCount(channel)).toBe(0);
    await follow(viewerA, channel);
    await follow(viewerB, channel);
    await follow(viewerA, otherChannel);
    expect(await followerCount(channel)).toBe(2);
    await unfollow(viewerA, channel);
    expect(await followerCount(channel)).toBe(1);
  });
});

describe('lastLiveAt', () => {
  it('配信したことがなければ null、配信を始めると知らせた時刻', async () => {
    const channel = await addChannel(await addUser());
    expect((await channelById(channel))?.lastLiveAt).toBeNull();
    await notifyLiveStarted(channel);
    expect((await channelById(channel))?.lastLiveAt).toBeInstanceOf(Date);
  });
});

describe('notifyLiveStarted', () => {
  it('知らせるのは10分に1度', async () => {
    const id = await addChannel(await addUser(), { name: 'ぴろ', handle: 'piro' });
    await notifyLiveStarted(id);
    await notifyLiveStarted(id);
    expect(sent.pushes).toHaveBeenCalledTimes(1);
    expect(sent.pushes).toHaveBeenCalledWith({
      channelId: id,
      displayName: 'ぴろ',
      handle: 'piro',
    });
    expect(sent.emails).toHaveBeenCalledTimes(1);
    await query(`update channel set notified_at = now() - interval '11 minutes' where id = $1`, [
      id,
    ]);
    await notifyLiveStarted(id);
    expect(sent.pushes).toHaveBeenCalledTimes(2);
  });

  it('同時に2つ来ても、知らせるのは片方だけ', async () => {
    const id = await addChannel(await addUser());
    await Promise.all([notifyLiveStarted(id), notifyLiveStarted(id)]);
    expect(sent.pushes).toHaveBeenCalledTimes(1);
  });

  it('つなぎ直しの前に時刻を進めると、知らせない', async () => {
    const id = await addChannel(await addUser());
    await holdLiveNotice(id);
    await notifyLiveStarted(id);
    expect(sent.pushes).not.toHaveBeenCalled();
  });

  it('止められたチャンネルは知らせない', async () => {
    const id = await addChannel(await addUser());
    await query('update channel set banned_at = now() where id = $1', [id]);
    await notifyLiveStarted(id);
    expect(sent.pushes).not.toHaveBeenCalled();
  });
});

describe('report', () => {
  const startedAt = new Date('2026-11-01T00:00:00Z');

  it('配信への1件目だけ true で、同じ人の二度目は数えない', async () => {
    const channelId = await addChannel(await addUser());
    const live = { channelId, startedAt };
    const first = await addUser();
    const second = await addUser();
    expect(await report(first, live, 'other')).toBe(true);
    expect(await report(first, live, 'other')).toBe(false);
    expect(await report(second, live, 'other')).toBe(false);
    expect(await hasReported(second, live)).toBe(true);
    expect((await reportersOf([live])).get(streamKey(live))).toBe(2);
  });

  it('自分のチャンネルは通報できない', async () => {
    const owner = await addUser();
    const live = { channelId: await addChannel(owner), startedAt };
    expect(await report(owner, live, 'other')).toBe(false);
    expect(await hasReported(owner, live)).toBe(false);
  });

  it('新しい配信は数え直す', async () => {
    const channelId = await addChannel(await addUser());
    const reporter = await addUser();
    await report(reporter, { channelId, startedAt }, 'other');
    const next = { channelId, startedAt: new Date('2026-11-01T01:00:00Z') };
    expect((await reportersOf([next])).get(streamKey(next))).toBeUndefined();
    expect(
      (await reportersOf([{ channelId, startedAt }])).get(streamKey({ channelId, startedAt })),
    ).toBe(1);
    expect(await report(reporter, next, 'other')).toBe(true);
  });
});

describe('reportComment', () => {
  const comment = {
    id: 'c1',
    name: '書いた人',
    text: 'ひどい',
    at: 1_800_000_000_000,
    guest: false,
  };

  it('コメントへの1件目だけ true で、本文を残す', async () => {
    const channelId = await addChannel(await addUser());
    expect(await reportComment(await addUser(), channelId, comment)).toBe(true);
    expect(await reportComment(await addUser(), channelId, comment)).toBe(false);
    const saved = await query('select body, display_name from reported_comment');
    expect(saved).toEqual([{ body: 'ひどい', display_name: '書いた人' }]);
    const [count] = await query<{ n: number }>('select count(*)::int as n from comment_report');
    expect(count?.n).toBe(2);
  });
});

describe('blockCommenter', () => {
  it('ログインした人は id と IP で止める', async () => {
    const channelId = await addChannel(await addUser());
    const user = await addUser();
    const author = { userId: user, ipKey: 'ip-a', displayName: 'あ' };
    expect(await blockCommenter(channelId, author, [])).toBe(true);
    expect(await commenterBlocked(channelId, user, null)).toBe(true);
    expect(await commenterBlocked(channelId, await addUser(), 'ip-a')).toBe(true);
    expect(await commenterBlocked(channelId, await addUser(), 'ip-b')).toBe(false);
  });

  it('配信者と同じ回線の人は id だけで止め、家族は止めない', async () => {
    const channelId = await addChannel(await addUser());
    const user = await addUser();
    const author = { userId: user, ipKey: 'ip-home', displayName: 'あ' };
    await blockCommenter(channelId, author, ['ip-home']);
    expect(await commenterBlocked(channelId, user, null)).toBe(true);
    expect(await commenterBlocked(channelId, await addUser(), 'ip-home')).toBe(false);
  });

  it('配信者と同じ回線のゲストは止められない', async () => {
    const channelId = await addChannel(await addUser());
    const author = { userId: 'guest:1', ipKey: 'ip-home', displayName: 'あ' };
    expect(await blockCommenter(channelId, author, ['ip-home'])).toBe(false);
  });
});
