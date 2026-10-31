import { AVATAR_IMAGE_MAX_BYTES, AVATAR_IMAGE_SIZE } from './avatar';

/** 縮めた画像の質。印は小さく出すので、これで粗さは目に付かない */
const QUALITY = 0.85;
/** 上限を超えたときに下げる質 */
const FALLBACK_QUALITY = 0.6;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * 選んだ画像を、真ん中を正方形に切り抜いて 256 px 四方に縮める（ブラウザで動く）。
 * WebP で書き出し、書き出せないブラウザでは JPEG にする。読めない画像なら null
 */
export async function shrinkAvatarImage(file: File): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_IMAGE_SIZE;
  canvas.height = AVATAR_IMAGE_SIZE;
  canvas
    .getContext('2d')
    ?.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_IMAGE_SIZE,
      AVATAR_IMAGE_SIZE,
    );
  bitmap.close();
  const webp = await toBlob(canvas, 'image/webp', QUALITY);
  // WebP を書き出せないブラウザは、黙って PNG を返す
  const blob = webp?.type === 'image/webp' ? webp : await toBlob(canvas, 'image/jpeg', QUALITY);
  if (blob && blob.size <= AVATAR_IMAGE_MAX_BYTES) return blob;
  return toBlob(canvas, 'image/jpeg', FALLBACK_QUALITY);
}
