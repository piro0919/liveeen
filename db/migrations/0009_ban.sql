-- 運営が配信者を止めた時刻（CLAUDE.md）。入っているあいだは配信が通らず（src/lib/media-auth.ts）、一覧にも出ない。
-- 戻すときは空にする
alter table channel add column banned_at timestamptz;
