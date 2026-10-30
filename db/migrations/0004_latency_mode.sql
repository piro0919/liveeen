-- 遅延の選び方（CLAUDE.md）。配信者が配信の前に選ぶ。
-- hls：遅れるが軽い。low：低遅延（WebRTC）。サーバーに重いので、見られる人数の上限は低くなる
alter table channel add column latency_mode text not null default 'hls';
alter table channel add constraint channel_latency_mode_check check (latency_mode in ('hls', 'low'));
