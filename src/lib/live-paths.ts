import { z } from 'zod';

/**
 * MediaMTX の API の配信の一覧（GET /v3/paths/list）のうち、使うところだけ。
 * 形は https://github.com/bluenviron/mediamtx/blob/v1.21.2/api/openapi.yaml
 */
const pathList = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      ready: z.boolean(),
      readyTime: z.string().nullable(),
    }),
  ),
});

export type LivePath = { channelId: string; startedAt: Date };

/** 配信中の一覧を、フォローしているものと、それ以外に分ける。どちらも並びはそのまま */
export function splitFollowed<T extends LivePath>(
  channels: T[],
  followed: ReadonlySet<string>,
): { followed: T[]; others: T[] } {
  return {
    followed: channels.filter((channel) => followed.has(channel.channelId)),
    others: channels.filter((channel) => !followed.has(channel.channelId)),
  };
}

/** 映像が届いている配信だけを、始まったのが新しい順に。形の合わない応答は空の一覧として扱う */
export function livePathsOf(body: unknown): LivePath[] {
  const parsed = pathList.safeParse(body);
  if (!parsed.success) return [];
  return parsed.data.items
    .filter((item) => item.ready && item.readyTime)
    .map((item) => ({ channelId: item.name, startedAt: new Date(item.readyTime as string) }))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}
