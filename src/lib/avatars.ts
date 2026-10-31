import 'server-only';
import { randomBytes } from 'node:crypto';
import { cache } from 'react';
import { type AvatarChoice, type AvatarImageType, avatarSrc } from './avatar';
import { db } from './db';

/**
 * 印を引くための表のつなぎ（db/migrations/0019_avatar.sql）。userIdColumn はその人の id の列。
 * AVATAR_COLUMNS と組にして使い、引いた行は avatarOfRow で住所にする
 */
export function avatarJoin(userIdColumn: string): string {
  return `left join "user" avatar_user on avatar_user.id = ${userIdColumn}
    left join avatar on avatar.user_id = ${userIdColumn}`;
}

export const AVATAR_COLUMNS = `avatar_user.image as "googleImage",
  coalesce(avatar.choice, 'google') as "avatarChoice", avatar.key as "avatarKey"`;

export type AvatarRow = {
  googleImage: string | null;
  avatarChoice: AvatarChoice;
  avatarKey: string | null;
};

export function avatarOfRow(row: AvatarRow): string | null {
  return avatarSrc({ choice: row.avatarChoice, googleImage: row.googleImage, key: row.avatarKey });
}

/** その人の印 */
export type Avatar = {
  /** 出す画像の住所。null なら名前の1文字 */
  src: string | null;
  choice: AvatarChoice;
  /** Google の写真があるか。無ければ「Google の写真にする」を出さない */
  hasGoogleImage: boolean;
};

/** その人の印。上の帯とページの両方が聞くので、1回の表示では1度だけ引く */
export const avatarOf = cache(async (userId: string): Promise<Avatar> => {
  const { rows } = await db().query<AvatarRow>(
    `select ${AVATAR_COLUMNS} from (select $1::text as id) me ${avatarJoin('me.id')}`,
    [userId],
  );
  const row = rows[0] ?? { googleImage: null, avatarChoice: 'google', avatarKey: null };
  return {
    src: avatarOfRow(row),
    choice: row.avatarChoice,
    hasGoogleImage:
      avatarSrc({ choice: 'google', googleImage: row.googleImage, key: null }) !== null,
  };
});

/** 名前の1文字か Google の写真に戻す。アップロードした画像は消す */
export async function setAvatarChoice(
  userId: string,
  choice: Exclude<AvatarChoice, 'upload'>,
): Promise<void> {
  if (choice === 'google') {
    await db().query('delete from avatar where user_id = $1', [userId]);
    return;
  }
  await db().query(
    `insert into avatar (user_id, choice) values ($1, 'initial')
     on conflict (user_id) do update
     set choice = 'initial', key = null, content_type = null, image = null, updated_at = now()`,
    [userId],
  );
}

/** 住所に使う値の長さ（バイト）。当て推量で引けない長さ */
const KEY_BYTES = 16;

/**
 * アップロードした画像を印にする。前の画像は置き換わり、住所も変わる（前の住所は開けなくなる）。
 * image は src/lib/avatar.ts で種類と大きさを確かめたもの
 */
export async function saveAvatarImage(
  userId: string,
  contentType: AvatarImageType,
  image: Buffer,
): Promise<void> {
  await db().query(
    `insert into avatar (user_id, choice, key, content_type, image) values ($1, 'upload', $2, $3, $4)
     on conflict (user_id) do update
     set choice = 'upload', key = excluded.key, content_type = excluded.content_type,
       image = excluded.image, updated_at = now()`,
    [userId, randomBytes(KEY_BYTES).toString('base64url'), contentType, image],
  );
}

/** 住所からアップロードした画像。無ければ null */
export async function avatarImageByKey(
  key: string,
): Promise<{ contentType: AvatarImageType; image: Buffer } | null> {
  const { rows } = await db().query<{ contentType: AvatarImageType; image: Buffer }>(
    `select content_type as "contentType", image from avatar where key = $1 and choice = 'upload'`,
    [key],
  );
  return rows[0] ?? null;
}
