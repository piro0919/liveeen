import { avatarImageByKey } from '@/lib/avatars';

const NOT_FOUND = 404;
/**
 * 手元と Vercel の CDN に置いてよい秒数。住所は上げ直すたびに変わるので、長く置いても古い画像は出ない。
 * 消したり退会したりした画像が CDN に残り続けないよう、1日で切る
 */
const CACHE_SECONDS = 86_400;

/**
 * アップロードした印の画像（db/migrations/0019_avatar.sql）。見るのにログインは要らない（配信の一覧とコメントに出る）。
 * 送られてきたものをそのまま返すので、種類の取り違えで中身を動かされないよう、種類を当て直させず、何も読み込ませない
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/avatar/[key]'>) {
  const found = await avatarImageByKey((await ctx.params).key);
  if (!found) return new Response(null, { status: NOT_FOUND });
  return new Response(new Uint8Array(found.image), {
    headers: {
      'Content-Type': found.contentType,
      'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
