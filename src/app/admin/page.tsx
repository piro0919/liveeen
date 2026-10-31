import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { banAction, removeCommentAction, stopStreamAction, unbanAction } from './actions';
import { ConfirmButton } from '@/components/confirm-button';
import { bannedChannels, isAdmin } from '@/lib/admin';
import { reportedComments } from '@/lib/comment-reports';
import { DELIST_THRESHOLD, streamKey } from '@/lib/delist';
import { channelPath } from '@/lib/handle';
import { liveRegisteredChannels } from '@/lib/live';
import { reasonSummary } from '@/lib/report-reason';
import { reportReasonsOf, reportersOf } from '@/lib/reports';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: '管理 | Liveeen' };

/** 日本の時刻で出す（初版は日本向け。CLAUDE.md） */
const timeFormat = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tokyo',
});

/**
 * 管理画面。運営（ADMIN_EMAILS）だけが開ける。ほかの人には、この画面が無いことにする。
 * 配信中のものを通報の多い順に出し、配信を止める・配信者を止めるを置く。通報されたコメントも通報の多い順に出し、消せる。止めた配信者は戻せる
 */
export default async function AdminPage() {
  if (!(await isAdmin())) notFound();
  const live = await liveRegisteredChannels();
  const reporters = await reportersOf(live);
  const reasons = await reportReasonsOf(live);
  const countOf = (channel: (typeof live)[number]) => reporters.get(streamKey(channel)) ?? 0;
  const reasonsOf = (channel: (typeof live)[number]) =>
    reasonSummary(reasons.get(streamKey(channel)) ?? new Map());
  const byReports = [...live].sort((a, b) => countOf(b) - countOf(a));
  const banned = await bannedChannels();
  const comments = await reportedComments();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className={ui.heading}>管理</h1>
      <section className={ui.card}>
        <h2 className={ui.subheading}>配信中</h2>
        {byReports.length === 0 ? (
          <p>いま配信している人はいません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {byReports.map((channel) => (
              <li key={channel.channelId} className="flex flex-wrap items-center gap-2">
                <Link
                  href={channelPath({ id: channel.channelId, handle: channel.handle })}
                  className={ui.link}
                >
                  {channel.displayName ?? channel.channelId}
                </Link>
                <span className={ui.note}>
                  {timeFormat.format(channel.startedAt)} から ・ 通報 {countOf(channel)}
                  {reasonsOf(channel) && `（${reasonsOf(channel)}）`}
                  {countOf(channel) >= DELIST_THRESHOLD && '（一覧から外した）'}
                </span>
                <ConfirmButton
                  label="配信を止める"
                  confirm="この配信を止めますか。配信者はつなぎ直せます"
                  action={stopStreamAction.bind(null, channel.channelId)}
                />
                <ConfirmButton
                  label="配信者を止める"
                  confirm="この配信者を止めますか。戻すまで配信できなくなります"
                  action={banAction.bind(null, channel.channelId)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={ui.card}>
        <h2 className={ui.subheading}>通報されたコメント</h2>
        {comments.length === 0 ? (
          <p>ありません</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((comment) => (
              <li key={comment.commentId} className="flex flex-col items-start gap-1">
                <p className="wrap-break-word">{comment.text}</p>
                <span className={ui.note}>
                  {comment.name}
                  {comment.guest && '（ゲスト）'} ・ {timeFormat.format(comment.commentedAt)} ・{' '}
                  <Link
                    href={channelPath({ id: comment.channelId, handle: comment.handle })}
                    className={ui.link}
                  >
                    {comment.channelName ?? comment.channelId}
                  </Link>{' '}
                  の配信 ・ 通報 {comment.count}
                </span>
                <ConfirmButton
                  label="消す"
                  confirm="このコメントを消しますか。見ている人全員の画面から消えます"
                  action={removeCommentAction.bind(null, comment.commentId)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={ui.card}>
        <h2 className={ui.subheading}>止めた配信者</h2>
        {banned.length === 0 ? (
          <p>いません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {banned.map((channel) => (
              <li key={channel.id} className="flex flex-wrap items-center gap-2">
                <Link href={channelPath(channel)} className={ui.link}>
                  {channel.displayName ?? channel.id}
                </Link>
                <span className={ui.note}>{timeFormat.format(channel.bannedAt)} に止めた</span>
                <ConfirmButton
                  label="戻す"
                  confirm="この配信者を戻しますか。また配信できるようになります"
                  action={unbanAction.bind(null, channel.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
