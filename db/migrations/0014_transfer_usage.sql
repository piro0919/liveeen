-- 最後に Akamai の API から読んだ、今月の課金される転送量（CLAUDE.md の月の上限）。行は1つだけ。
-- 視聴のたびに API を呼ばないよう、しばらくはこれを使う（src/lib/transfer.ts）
create table transfer_usage (
  id boolean primary key default true constraint transfer_usage_single_row check (id),
  billable_gb double precision not null,
  fetched_at timestamptz not null
);
