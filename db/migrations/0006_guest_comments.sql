-- ログインしていない人がコメントを書けるか。配信者が配信ごとに選ぶ（CLAUDE.md）。
-- 既定は書けない。未ログインで荒らす人は、名前を変えてまた来られるため
alter table channel add column guest_comments boolean not null default false;
