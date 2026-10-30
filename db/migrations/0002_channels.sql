-- 配信者のチャンネル。1人に1つ。
-- id は MediaMTX の配信の名前（rtmp://…/<id>、WHIP の …/<id>/whip）にそのまま使う。
-- 配信の鍵は SHA-256 にして持つ。DB が漏れても、鍵そのものは出ない（src/lib/stream-key.ts）。
-- 鍵とチャンネルを作るところは、配信を始める画面と一緒に作る
create table channel (
  id text not null primary key,
  user_id text not null unique references "user" ("id") on delete cascade,
  stream_key_hash text not null unique,
  created_at timestamptz not null default now()
);
