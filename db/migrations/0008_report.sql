-- 見る人からの通報（CLAUDE.md）。配信1回ごとに数える。配信の始まった時刻（MediaMTX の readyTime）で1回を見分ける。
-- 通報はログインした人だけ、1回の配信に1人1件。同じ配信で通報した人が決まった数に届いたら、トップの一覧から外す（src/lib/reports.ts）
create table report (
  channel_id text not null references channel (id) on delete cascade,
  stream_started_at timestamptz not null,
  user_id text not null references "user" ("id") on delete cascade,
  created_at timestamptz not null default now(),
  primary key (channel_id, stream_started_at, user_id)
);
