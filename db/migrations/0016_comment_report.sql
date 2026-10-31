-- 通報されたコメント（CLAUDE.md の Comments）。コメントはふだん保存しないが、通報されたものだけ、運営が見て消せるように残す。
-- 本文・名前・時刻は通報された時点で中継が流していたそのもの（src/lib/comment-token.ts の signCommentProof で確かめる）。
-- 書いた人の id は持たない。removed_at は運営が消した時刻で、消したものは管理画面に出さない
create table reported_comment (
  comment_id text primary key,
  channel_id text not null references channel ("id") on delete cascade,
  display_name text not null,
  guest boolean not null,
  body text not null,
  commented_at timestamptz not null,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

create index reported_comment_channel_id_idx on reported_comment (channel_id);

-- 誰が通報したか。ログインした人だけ、1つのコメントに1人1件
create table comment_report (
  comment_id text not null references reported_comment (comment_id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index comment_report_user_id_idx on comment_report (user_id);
