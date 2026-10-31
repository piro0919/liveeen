-- 人の丸い印（アイコン）。既定は Google の写真（"user".image）で、行は無い。
-- 本人が名前の1文字に戻すか（initial）、画像をアップロードしたとき（upload）だけ行を持つ（CLAUDE.md）。
-- アップロードした画像は 256 px 四方に縮めてから、ここに入れる。形と大きさは src/lib/avatar.ts が確かめる。
-- key は画像の住所（/api/avatar/<key>）。利用者の id を見る人に見せないよう、別にでたらめな値を振り、上げ直すたびに変える
create table avatar (
  user_id text not null primary key references "user" ("id") on delete cascade,
  choice text not null constraint avatar_choice_check check (choice in ('initial', 'upload')),
  key text,
  content_type text
    constraint avatar_content_type_check check (content_type in ('image/webp', 'image/jpeg', 'image/png')),
  image bytea constraint avatar_image_size_check check (octet_length(image) <= 102400),
  updated_at timestamptz not null default now(),
  constraint avatar_upload_check check (
    (choice = 'upload') = (key is not null and content_type is not null and image is not null)
  )
);

create unique index avatar_key_key on avatar (key);
