-- 配信者がコメントした人を止めたもの（CLAUDE.md の Comments）。止めた人は、そのチャンネルでコメントを書けない。
-- ログインした人は id と IP の両方で、ゲストは IP で止める。ゲストの id は札ごとに替わるので持たない。
-- ip_key は IP を署名の鍵で混ぜた値（src/lib/ip-key.ts）で、IP そのものは持たない。
-- 名前は止めた時点のもの。一覧（/broadcast）に出す
create table comment_block (
  id bigint generated always as identity primary key,
  channel_id text not null references channel ("id") on delete cascade,
  user_id text references "user" ("id") on delete cascade,
  ip_key text,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint comment_block_target check (user_id is not null or ip_key is not null)
);

create index comment_block_channel_id_idx on comment_block (channel_id);
