import 'server-only';
import { db } from './db';
import { streamKey } from './delist';
import type { LivePath } from './live-paths';
import type { ReportReason } from './report-reason';

/** 通報する。同じ配信に二度目は数えない（理由も変えない）。自分のチャンネルは通報できない */
export async function report(userId: string, live: LivePath, reason: ReportReason): Promise<void> {
  await db().query(
    `insert into report (channel_id, stream_started_at, user_id, reason)
     select id, $2, $3, $4 from channel where id = $1 and user_id <> $3
     on conflict do nothing`,
    [live.channelId, live.startedAt, userId, reason],
  );
}

/** その配信をもう通報したか */
export async function hasReported(userId: string, live: LivePath): Promise<boolean> {
  const { rowCount } = await db().query(
    'select 1 from report where channel_id = $1 and stream_started_at = $2 and user_id = $3',
    [live.channelId, live.startedAt, userId],
  );
  return rowCount === 1;
}

/** 配信ごとの、通報した人の数。鍵は streamKey（src/lib/delist.ts） */
export async function reportersOf(lives: LivePath[]): Promise<Map<string, number>> {
  if (lives.length === 0) return new Map();
  const { rows } = await db().query<{ channelId: string; startedAt: Date; count: number }>(
    `select r.channel_id as "channelId", r.stream_started_at as "startedAt", count(*)::int as count
     from report r
     join unnest($1::text[], $2::timestamptz[]) as live (channel_id, started_at)
       on live.channel_id = r.channel_id and live.started_at = r.stream_started_at
     group by r.channel_id, r.stream_started_at`,
    [lives.map((live) => live.channelId), lives.map((live) => live.startedAt)],
  );
  return new Map(rows.map((row) => [streamKey(row), row.count]));
}

/** 配信ごとの、理由ごとの通報の数。鍵は streamKey（src/lib/delist.ts）。理由を聞く前の通報は null */
export async function reportReasonsOf(
  lives: LivePath[],
): Promise<Map<string, Map<ReportReason | null, number>>> {
  if (lives.length === 0) return new Map();
  const { rows } = await db().query<{
    channelId: string;
    startedAt: Date;
    reason: ReportReason | null;
    count: number;
  }>(
    `select r.channel_id as "channelId", r.stream_started_at as "startedAt", r.reason,
       count(*)::int as count
     from report r
     join unnest($1::text[], $2::timestamptz[]) as live (channel_id, started_at)
       on live.channel_id = r.channel_id and live.started_at = r.stream_started_at
     group by r.channel_id, r.stream_started_at, r.reason`,
    [lives.map((live) => live.channelId), lives.map((live) => live.startedAt)],
  );
  const byStream = new Map<string, Map<ReportReason | null, number>>();
  for (const row of rows) {
    const key = streamKey(row);
    const counts = byStream.get(key) ?? new Map<ReportReason | null, number>();
    counts.set(row.reason, row.count);
    byStream.set(key, counts);
  }
  return byStream;
}
