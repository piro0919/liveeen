-- コメントを止める（CLAUDE.md の Comment moderation）。true の間は配信者とモデレーターだけが書ける
alter table channel add column comments_closed boolean not null default false;
