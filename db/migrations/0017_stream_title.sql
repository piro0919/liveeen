-- 配信のタイトル（CLAUDE.md）。配信者が付ける。トップの一覧と見る画面に出す。付けていなければ null。
-- 長さと形は src/lib/stream-title.ts が確かめる
alter table channel add column title text;
