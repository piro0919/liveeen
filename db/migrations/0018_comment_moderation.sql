-- 配信者が決めるコメントの決まり（CLAUDE.md の Comment moderation）。形は src/lib/comment-settings.ts が確かめる。
-- slow_mode_seconds：1人が続けて書ける間隔（秒）。0 はなし。
-- blocked_words：含むコメントをほかの人に流さない言葉。
-- followers_only_minutes：フォローしてからこの分数がたった人だけ書ける。null は誰でも。
-- comment_settings_at：決まりを変えた時刻。中継は新しいほうを使う。
-- owner_ip_key：配信者がコメントにつないだときの IP の鍵（src/lib/ip-key.ts）。
-- モデレーターがブロックするとき、配信者と同じ回線の人を IP で止めないために使う。
-- 数の列は squawk の勧めで bigint にする（読むときに int へ直す。src/lib/channels.ts）
alter table channel add column slow_mode_seconds bigint not null default 0
  constraint channel_slow_mode_seconds_check check (slow_mode_seconds between 0 and 600);
alter table channel add column blocked_words text[] not null default '{}';
alter table channel add column followers_only_minutes bigint
  constraint channel_followers_only_minutes_check check (followers_only_minutes >= 0);
alter table channel add column comment_settings_at timestamptz not null default now();
alter table channel add column owner_ip_key text;

-- モデレーター。配信者がコメントした人から選ぶ。そのチャンネルでブロックでき、低速モードと禁止語にかからない
create table channel_moderator (
  channel_id text not null references channel (id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  created_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index channel_moderator_user_id_idx on channel_moderator (user_id);
