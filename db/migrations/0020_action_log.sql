-- 1人が短い間に繰り返す重い書き込みの記録（src/lib/rate-limit.ts。鯉魂・spatto の回数制限と同じ考え）。
-- いまはアイコンのアップロードだけ。1回で 100 KB までの画像が DB に入り、DB は無料の枠の大きさで動いているため。
-- 数える時間より古い行は、数えるときに消す
create table action_log (
  id bigint generated always as identity primary key,
  user_id text not null references "user" ("id") on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index action_log_user_action_idx on action_log (user_id, action, created_at);
