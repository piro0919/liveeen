-- 通報の理由（CLAUDE.md）。通報する人が選ぶ。選べるものは src/lib/report-reason.ts と同じ。
-- 理由を聞く前の通報は null
alter table report add column reason text
  constraint report_reason_check check (reason in ('sexual', 'violence', 'harassment', 'other'));
