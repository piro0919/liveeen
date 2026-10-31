/**
 * 人の丸い印（アイコン）の決まり（db/migrations/0019_avatar.sql）。
 * 既定は Google の写真。本人が名前の1文字に戻すか、画像をアップロードして差し替える
 */
export type AvatarChoice = 'google' | 'initial' | 'upload';

/** アップロードした画像の一辺。画面で出す一番大きい印（40 px）の、画素の細かい画面での大きさに余裕を持たせた */
export const AVATAR_IMAGE_SIZE = 256;
/** アップロードした画像の大きさの上限（バイト）。ブラウザで 256 px 四方に縮めてから送るので、ふつうは数十 KB に収まる */
export const AVATAR_IMAGE_MAX_BYTES = 102_400;

/** アップロードした画像の住所 */
export function uploadedAvatarPath(key: string): string {
  return `/api/avatar/${encodeURIComponent(key)}`;
}

/**
 * 印に出す画像の住所。null なら名前の1文字を出す。
 * choice は本人が選んだもの（行が無ければ google）、googleImage は Google の写真、key はアップロードした画像の住所
 */
export function avatarSrc({
  choice,
  googleImage,
  key,
}: {
  choice: AvatarChoice;
  googleImage: string | null;
  key: string | null;
}): string | null {
  if (choice === 'initial') return null;
  if (choice === 'upload') return key ? uploadedAvatarPath(key) : null;
  // Google から来た値なので、https の住所だけを使う
  return googleImage?.startsWith('https://') ? googleImage : null;
}

export type AvatarImageType = 'image/webp' | 'image/jpeg' | 'image/png';

const HEX = 16;
const HEX_DIGITS = 2;

/** offset から、expected（16進の文字列）と同じバイトが並んでいるか */
function startsWith(bytes: Uint8Array, offset: number, expected: string): boolean {
  const length = expected.length / HEX_DIGITS;
  const actual = Array.from(bytes.subarray(offset, offset + length), (byte) =>
    byte.toString(HEX).padStart(HEX_DIGITS, '0'),
  ).join('');
  return actual === expected;
}

const JPEG = 'ffd8ff';
const PNG = '89504e470d0a1a0a';
/** 'RIFF' と 'WEBP'。WebP は RIFF の頭（4バイト）と大きさ（4バイト）のあとに WEBP が来る */
const RIFF = '52494646';
const WEBP = '57454250';
const WEBP_OFFSET = 8;

/**
 * 送られてきた画像の種類を、中身の頭のバイトで見分ける。ブラウザが言う種類は信じない。
 * WebP・JPEG・PNG のどれでもなければ null
 */
export function sniffAvatarImage(bytes: Uint8Array): AvatarImageType | null {
  if (startsWith(bytes, 0, RIFF) && startsWith(bytes, WEBP_OFFSET, WEBP)) return 'image/webp';
  if (startsWith(bytes, 0, JPEG)) return 'image/jpeg';
  if (startsWith(bytes, 0, PNG)) return 'image/png';
  return null;
}
