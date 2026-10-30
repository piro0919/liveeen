-- フォロー。見る人がチャンネルをフォローする（CLAUDE.md）
create table follow (
  user_id text not null references "user" ("id") on delete cascade,
  channel_id text not null references channel (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

create index follow_channel_id_idx on follow (channel_id);

-- フォローした人が配信を始めたときの知らせ方。見る人が設定で1つずつ切り替える（CLAUDE.md）。
-- 行が無ければ既定のまま。いまはトップの上に出すかだけ。ブラウザ通知とメールは作るときに列を足す
create table notification_setting (
  user_id text not null primary key references "user" ("id") on delete cascade,
  list_on_top boolean not null default true
);
