-- 配信は18歳以上で、本人の申告による（CLAUDE.md）。チャンネルを作るときに申告してもらい、その時刻を残す。
-- 既にあるチャンネルは手元の試しのものだけなので、作った時刻を入れる
alter table channel add column adult_declared_at timestamptz;
update channel set adult_declared_at = created_at;
