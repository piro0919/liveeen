'use server';

import { randomUUID } from 'node:crypto';
import { refresh } from 'next/cache';
import { after } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { avatarOf } from '@/lib/avatars';
import { blockCommenter, commenterBlocked } from '@/lib/blocks';
import { isBot } from '@/lib/bot';
import { channelOf } from '@/lib/channels';
import { type Comment, guestId, isGuestId } from '@/lib/comment';
import { commandRelay } from '@/lib/comment-removal';
import { reportComment } from '@/lib/comment-reports';
import { followerMayWrite } from '@/lib/comment-settings';
import {
  addModerator,
  commentContextOf,
  isModerator,
  ownerIpKeyOf,
  rememberOwnerIpKey,
} from '@/lib/moderation';
import { signCommentToken, verifyAuthor, verifyCommentProof } from '@/lib/comment-token';
import { requestIpKey } from '@/lib/request-ip';
import { normalizeDisplayName } from '@/lib/display-name';
import { follow, followedAtOf, unfollow } from '@/lib/follows';
import { liveStream, publishing } from '@/lib/live';
import { isReportReason } from '@/lib/report-reason';
import { notifyAdminsOfReport } from '@/lib/report-notice';
import { report } from '@/lib/reports';
import { displayNameOf } from '@/lib/profiles';
import { currentUserId } from '@/lib/session';
import { env } from '@/env';

/** フォローする（on）／やめる。ログインが要る */
export async function setFollowingAction(channelId: string, on: boolean): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  if (on) await follow(userId, channelId);
  else await unfollow(userId, channelId);
  refresh();
}

/** 通報の結果。配信していなければ数える配信が無い */
export type ReportResult = 'reported' | 'offline';

/** いまの配信を通報する（CLAUDE.md）。ログインが要る。配信1回に1人1件。理由は選んでもらう */
export async function reportAction(channelId: string, reason: string): Promise<ReportResult> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  if (!isReportReason(reason)) throw new Error(`通報の理由が違います: ${reason}`);
  const live = await liveStream(channelId);
  if (!live) return 'offline';
  if (await report(userId, live, reason)) {
    const tReason = await getTranslations('reportReasons');
    const reasonName = tReason(reason);
    after(() => notifyAdminsOfReport('stream', reasonName));
  }
  return 'reported';
}

/**
 * コメントの札。token が null なら読むだけでつなぐ。blocked は配信者に止められていること。
 * followersOnly は、配信者の決まり（フォロワー限定）でいまは書けない人に、書く欄の代わりに見せる知らせ。
 * フォローしてから要る分数（0 ならフォローしているだけでよい）。
 * writableAt は、フォローしてからの時間がたって書けるようになる時刻（見る画面はそのとき札をもらい直す）
 */
export type CommentTokenResult = {
  token: string | null;
  blocked: boolean;
  followersOnly: number | null;
  writableAt?: number;
};

const READ_ONLY: CommentTokenResult = { token: null, blocked: false, followersOnly: null };
const MS_PER_MINUTE = 60_000;

/**
 * コメントの中継につなぐための札（src/lib/comment-token.ts）。
 * ログインして名前を付けた人には、その名前で出す。
 * ログインしていない人には、配信者が許していて（db/migrations/0006_guest_comments.sql）、その場で入れた名前があるときだけ出す。
 * 配信者が止めた人には出さない（src/lib/blocks.ts）。配信者自身は止められない。
 * 札には、モデレーターか・フォローした時刻・コメントの決まりを入れる（中継は DB を持たない）。
 * フォロワー限定でまだ書けない人にも札は出し（中継が書き込みを断る）、書く欄の代わりに理由を見せる
 */
export async function commentTokenAction(
  channelId: string,
  guestName: string | null,
): Promise<CommentTokenResult> {
  const secret = env.COMMENT_TOKEN_SECRET;
  if (!secret) return READ_ONLY;
  const [context, ipKey, userId] = await Promise.all([
    commentContextOf(channelId),
    requestIpKey(secret),
    currentUserId(),
  ]);
  if (!context) return READ_ONLY;
  const { settings } = context;
  const now = Date.now();
  if (userId) {
    const owner = context.ownerId === userId;
    // 互いに関係ない問い合わせは、まとめて投げる（関数は sin1、DB はシンガポールでも、往復が積み重なる）
    const [displayName, avatar, blocked, moderator, followedAt] = await Promise.all([
      displayNameOf(userId),
      avatarOf(userId),
      owner ? false : commenterBlocked(channelId, userId, ipKey),
      owner ? false : isModerator(channelId, userId),
      followedAtOf(userId, channelId),
    ]);
    if (!displayName) return READ_ONLY;
    if (owner && context.ownerIpKey !== ipKey) await rememberOwnerIpKey(channelId, ipKey);
    if (blocked) return { token: null, blocked: true, followersOnly: null };
    const commenter = {
      userId,
      displayName,
      ipKey,
      owner,
      moderator,
      followedAt,
      settings,
      ownerIpKey: context.ownerIpKey,
      avatar: avatar.src,
    };
    const minutes = settings.followersOnlyMinutes;
    const waiting = !owner && !moderator && !followerMayWrite(settings, followedAt, now);
    return {
      token: signCommentToken(secret, channelId, commenter, now),
      blocked: false,
      followersOnly: waiting ? (minutes ?? 0) : null,
      writableAt:
        waiting && followedAt !== null && minutes !== null
          ? followedAt + minutes * MS_PER_MINUTE
          : undefined,
    };
  }
  if (!guestName) return READ_ONLY;
  const name = normalizeDisplayName(guestName);
  if (!name.ok) return READ_ONLY;
  if (!context.guestComments) return READ_ONLY;
  // ゲストはフォローできないので、フォロワー限定のあいだは書けない
  if (settings.followersOnlyMinutes !== null) {
    return { ...READ_ONLY, followersOnly: settings.followersOnlyMinutes };
  }
  if (await commenterBlocked(channelId, null, ipKey)) {
    return { token: null, blocked: true, followersOnly: null };
  }
  // ログインなしで名前を変えて何度でも札を取れるので、ボットには出さない（src/lib/bot.ts）
  if (await isBot()) return READ_ONLY;
  // 未ログインの人には決まった id が無い。札ごとに振る
  const guest = {
    userId: guestId(randomUUID()),
    displayName: name.name,
    ipKey,
    owner: false,
    settings,
    ownerIpKey: context.ownerIpKey,
  };
  return {
    token: signCommentToken(secret, channelId, guest, now),
    blocked: false,
    followersOnly: null,
  };
}

/** 配信者か、そのチャンネルのモデレーターか。ブロックできる人 */
async function mayModerate(channelId: string, userId: string): Promise<boolean> {
  return (await channelOf(userId))?.id === channelId || (await isModerator(channelId, userId));
}

/**
 * コメントした人を止める。配信者とモデレーターができる。author は中継がコメントに付けた札（src/lib/comment-token.ts）。
 * 配信者とモデレーターは止められない。中継にも見る画面から知らせ、その場で書けなくする（relay/relay.ts）
 */
export async function blockCommenterAction(channelId: string, author: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  if (!(await mayModerate(channelId, userId))) throw new Error('ブロックできません');
  const secret = env.COMMENT_TOKEN_SECRET;
  if (!secret) throw new Error('COMMENT_TOKEN_SECRET がありません');
  const verified = verifyAuthor(secret, author, channelId);
  if (!verified) throw new Error('書いた人の札が合いません');
  if (verified.userId === userId) throw new Error('自分は止められません');
  if (await mayModerate(channelId, verified.userId)) {
    throw new Error('配信者とモデレーターは止められません');
  }
  // 配信者とブロックした人の回線は IP では止めない
  const spared = [await requestIpKey(secret), await ownerIpKeyOf(channelId)];
  await blockCommenter(channelId, verified, spared);
}

/**
 * コメントした人をモデレーターにする。配信者だけができる。ログインしていない人はなれない。
 * 中継に知らせて、その人をつなぎ直させ、新しい札（モデレーターの印つき）でその場から効かせる
 */
export async function appointModeratorAction(channelId: string, author: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  if ((await channelOf(userId))?.id !== channelId)
    throw new Error('自分のチャンネルではありません');
  const secret = env.COMMENT_TOKEN_SECRET;
  if (!secret) throw new Error('COMMENT_TOKEN_SECRET がありません');
  const verified = verifyAuthor(secret, author, channelId);
  if (!verified) throw new Error('書いた人の札が合いません');
  if (isGuestId(verified.userId)) throw new Error('ログインしていない人はモデレーターにできません');
  await addModerator(channelId, verified.userId);
  await commandRelay(env.NEXT_PUBLIC_COMMENT_RELAY_URL, secret, channelId, {
    kind: 'roles',
    userId: verified.userId,
  }).catch(() => {
    // 中継に届かなくても、その人が次につなぎ直したときから効く
  });
}

/**
 * その配信が、いま配信サーバーに届いているか。分からなければ null。見るのにログインは要らないので、誰でも聞ける。
 * WebRTC の視聴のつながりが揺れたときに、配信が終わったのかを確かめる
 */
export async function channelPublishingAction(channelId: string): Promise<boolean | null> {
  return publishing(channelId);
}

/** 通報するコメント。中継が流したそのまま（src/lib/comment.ts） */
type ReportedCommentInput = Pick<Comment, 'id' | 'name' | 'text' | 'at' | 'guest' | 'proof'>;

/**
 * コメントを通報する。ログインが要る。1つのコメントに1人1件。
 * 中身が中継の流したものと同じかを印で確かめ（src/lib/comment-token.ts）、通報されたものだけ保存する
 */
export async function reportCommentAction(
  channelId: string,
  comment: ReportedCommentInput,
): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('ログインしていません');
  const secret = env.COMMENT_TOKEN_SECRET;
  if (!secret) throw new Error('COMMENT_TOKEN_SECRET がありません');
  const shown = {
    id: String(comment.id),
    name: String(comment.name),
    text: String(comment.text),
    at: Number(comment.at),
    guest: comment.guest === true,
  };
  if (!comment.proof || !verifyCommentProof(secret, channelId, shown, String(comment.proof))) {
    throw new Error('コメントの印が合いません');
  }
  if (await reportComment(userId, channelId, shown)) {
    after(() => notifyAdminsOfReport('comment', null));
  }
}
