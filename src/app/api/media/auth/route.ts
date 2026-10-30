import { allowMedia, mediaAuthRequest } from '@/lib/media-auth';
import { db } from '@/lib/db';
import { env } from '@/env';

const ALLOWED = 200;
const BAD_REQUEST = 400;
const DENIED = 401;

async function channelKeyMatches(channelId: string, streamKeyHash: string): Promise<boolean> {
  const { rowCount } = await db().query(
    'select 1 from channel where id = $1 and stream_key_hash = $2',
    [channelId, streamKeyHash],
  );
  return rowCount === 1;
}

/**
 * MediaMTX の確かめの受け口（media/mediamtx.yml の authHTTPAddress）。
 * 2xx を返すと通り、それ以外は断られる
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = mediaAuthRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: BAD_REQUEST });
  const allowed = await allowMedia(parsed.data, {
    channelKeyMatches,
    tokenSecret: env.MEDIA_TOKEN_SECRET,
    now: Date.now(),
  });
  return new Response(null, { status: allowed ? ALLOWED : DENIED });
}
