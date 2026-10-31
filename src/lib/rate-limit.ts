import 'server-only';
import { db } from './db';

/** 回数を数える書き込みと、その上限。window は秒 */
const LIMITS = {
  /** アイコンのアップロード。1時間に10回まで（選び直すのは普通は数回） */
  avatarUpload: { max: 10, windowSeconds: 3600 },
} as const;

export type LimitedAction = keyof typeof LIMITS;

/**
 * その人がまだその書き込みをしてよいか。よければ1回と数える（db/migrations/0020_action_log.sql）。
 * 数える時間より古い記録はここで消す。同時に来た分は少しはみ出すことがあるが、止めたいのは繰り返しなので構わない
 */
export async function withinLimit(userId: string, action: LimitedAction): Promise<boolean> {
  const { max, windowSeconds } = LIMITS[action];
  const { rows } = await db().query<{ ok: boolean }>(
    `with removed as (
       delete from action_log
       where user_id = $1 and action = $2 and created_at < now() - make_interval(secs => $3)
     ), counted as (
       select count(*)::int as n from action_log
       where user_id = $1 and action = $2 and created_at >= now() - make_interval(secs => $3)
     ), added as (
       insert into action_log (user_id, action)
       select $1, $2 from counted where n < $4
       returning 1
     )
     select exists (select 1 from added) as ok`,
    [userId, action, windowSeconds, max],
  );
  return rows[0]?.ok ?? false;
}
