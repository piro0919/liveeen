-- フォローした人が配信を始めたら、メールで知らせるか（CLAUDE.md）。送り先はログインに使った Google のメールアドレス。
-- 頼まれていないメールを送らないよう、入れた人にだけ送る（src/lib/email.ts）
alter table notification_setting add column email boolean not null default false;
