-- フォローした人が配信を始めたときのブラウザ通知（Web Push）。見る人がブラウザごとに設定で入れる（CLAUDE.md）。
-- 送り口（endpoint）はブラウザが作るもので、ブラウザ1つに1つ。同じブラウザで別の人が入れ直したら、その人のものにする
create table push_subscription (
  endpoint text not null primary key,
  user_id text not null references "user" ("id") on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscription_user_id_idx on push_subscription (user_id);

-- 最後に配信の始まりを知らせた時刻。OBS は切れるとすぐにつなぎ直すので、間を置かずに始まった配信は知らせ直さない（src/lib/push.ts）
alter table channel add column notified_at timestamptz;
