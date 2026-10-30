-- 人前に出す名前。本人が自分で付ける（Google の名前は本名のことが多いので出さない。CLAUDE.md）。
-- Better Auth の "user" 表には足さず、別の表に持つ。同じ名前の人がいてもよい。
-- 長さは見た目の文字数で src/lib/display-name.ts が確かめる。ここは絵文字の組み合わせも入る広さの歯止め
create table profile (
  user_id text not null primary key references "user" ("id") on delete cascade,
  display_name text not null,
  updated_at timestamptz not null default now(),
  constraint profile_display_name_check check (char_length(display_name) between 1 and 200)
);
