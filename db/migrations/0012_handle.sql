-- 配信者の住所（/@ハンドル）。本人が選ぶ（CLAUDE.md）。人前に出す名前（display_name）と違い、ほかの人と重ならない。
-- 配信の画面で名前の次に聞くので、名前と同じ表に持つ。まだ選んでいなければ null。
-- 形は src/lib/handle.ts が確かめる。ここは同じ形の歯止め
alter table profile add column handle text
  constraint profile_handle_check check (handle ~ '^[a-z0-9_]{3,20}$');

-- 重なりは一意の索引で止める（重なれば 23505。src/lib/profiles.ts）。
-- 一意の制約を後から足すと表全体を止めるので、squawk の勧めに従って索引にする
create unique index profile_handle_key on profile (handle);
