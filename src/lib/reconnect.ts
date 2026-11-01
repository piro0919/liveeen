import { ScreenError } from './screen-error';

/** 短い切断のあいだ、つなぎ直しを続ける長さ（手本の Twitch の Disconnect Protection と同じ90秒） */
export const RECONNECT_LIMIT_MS = 90_000;
/** つなぎ直しの間隔 */
export const RECONNECT_WAIT_MS = 3000;

/** 配信サーバーかサイトがはっきり断った。運営が止めた配信者など。待っても変わらないので、すぐあきらめる */
export function refusedForGood(error: unknown): boolean {
  if (!(error instanceof ScreenError) || error.key !== 'whipFailed') return false;
  const status = error.values?.status;
  return status === 401 || status === 403;
}

/**
 * 取れるまで繰り返す。期限を過ぎるか、やめる合図が出るか、あきらめる失敗が出たら null。
 * 求めは通るのにつながらない回線では、取れても切れてまたここへ来る。期限を過ぎていたら試さず終える
 */
export async function retryUntil<T>(
  attempt: () => Promise<T>,
  {
    deadline,
    waitMs,
    cancelled,
    giveUp,
    now = Date.now,
  }: {
    deadline: number;
    waitMs: number;
    cancelled: () => boolean;
    giveUp: (error: unknown) => boolean;
    now?: () => number;
  },
): Promise<T | null> {
  while (!cancelled() && now() < deadline) {
    try {
      return await attempt();
    } catch (error) {
      if (giveUp(error)) return null;
    }
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return null;
}
