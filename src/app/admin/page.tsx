import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
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

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('admin'))('title') };
}

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
  const t = await getTranslations('admin');
  const tReason = await getTranslations('reportReasons');
  const tComments = await getTranslations('comments');
  const live = await liveRegisteredChannels();
  const reporters = await reportersOf(live);
  const reasons = await reportReasonsOf(live);
  const countOf = (channel: (typeof live)[number]) => reporters.get(streamKey(channel)) ?? 0;
  const reasonsOf = (channel: (typeof live)[number]) =>
    reasonSummary(reasons.get(streamKey(channel)) ?? new Map(), (reason) => tReason(reason));
  const byReports = [...live].sort((a, b) => countOf(b) - countOf(a));
  const banned = await bannedChannels();
  const comments = await reportedComments();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className={ui.heading}>{t('heading')}</h1>
      <section className={ui.card}>
        <h2 className={ui.subheading}>{t('live')}</h2>
        {byReports.length === 0 ? (
          <p>{t('noLive')}</p>
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
                {/* タイトルも通報の理由になりうるので、運営に見せる */}
                {channel.title && <span className="wrap-break-word">{channel.title}</span>}
                <span className={ui.note}>
                  {t('streamMeta', {
                    time: timeFormat.format(channel.startedAt),
                    count: countOf(channel),
                  })}
                  {reasonsOf(channel) && t('reasons', { reasons: reasonsOf(channel) })}
                  {countOf(channel) >= DELIST_THRESHOLD && t('delisted')}
                </span>
                <ConfirmButton
                  label={t('stopStream')}
                  confirm={t('confirmStopStream')}
                  action={stopStreamAction.bind(null, channel.channelId)}
                />
                <ConfirmButton
                  label={t('ban')}
                  confirm={t('confirmBan')}
                  action={banAction.bind(null, channel.channelId)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={ui.card}>
        <h2 className={ui.subheading}>{t('reportedComments')}</h2>
        {comments.length === 0 ? (
          <p>{t('noComments')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((comment) => (
              <li key={comment.commentId} className="flex flex-col items-start gap-1">
                <p className="wrap-break-word">{comment.text}</p>
                <span className={ui.note}>
                  {t.rich('commentMeta', {
                    name: comment.guest ? comment.name + tComments('guestMark') : comment.name,
                    time: timeFormat.format(comment.commentedAt),
                    channel: comment.channelName ?? comment.channelId,
                    count: comment.count,
                    link: (chunks) => (
                      <Link
                        href={channelPath({ id: comment.channelId, handle: comment.handle })}
                        className={ui.link}
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </span>
                <ConfirmButton
                  label={t('removeComment')}
                  confirm={t('confirmRemoveComment')}
                  action={removeCommentAction.bind(null, comment.commentId)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={ui.card}>
        <h2 className={ui.subheading}>{t('banned')}</h2>
        {banned.length === 0 ? (
          <p>{t('noBanned')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {banned.map((channel) => (
              <li key={channel.id} className="flex flex-wrap items-center gap-2">
                <Link href={channelPath(channel)} className={ui.link}>
                  {channel.displayName ?? channel.id}
                </Link>
                <span className={ui.note}>
                  {t('bannedAt', { time: timeFormat.format(channel.bannedAt) })}
                </span>
                <ConfirmButton
                  label={t('unban')}
                  confirm={t('confirmUnban')}
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
