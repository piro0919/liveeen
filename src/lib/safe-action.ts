import { unstable_rethrow } from 'next/navigation';

/** 呼び出しが届かなかったことを、画面の知らせ（src/components/toaster.tsx）へ伝えるイベントの名前 */
export const ACTION_FAILED_EVENT = 'liveeen:action-failed';

/**
 * ブラウザから Server Action を呼ぶときは、かならずこれを通す（shodolog と同じ。test/client-actions.test.ts が見る）。
 *
 * 電波が切れる・サーバーが落ちるなどで呼び出しが投げられると、そのままでは押しても何も出ずにボタンが戻るか、
 * 画面ごと誤りの画面へ落ちる。本人は保存できたと思って離れる。
 * 投げられたら「うまく届きませんでした」の知らせを出し、undefined を返す（呼んだ側は前の状態のままにする）。
 * Next の redirect と notFound は投げ直す
 */
export async function safely<T>(call: () => Promise<T>): Promise<T | undefined> {
  try {
    return await call();
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    window.dispatchEvent(new Event(ACTION_FAILED_EVENT));
    return undefined;
  }
}

/** useActionState に渡す Server Action を包む。届かなければ前の状態のままにする */
export function guarded<State, Payload>(
  action: (state: State, payload: Payload) => Promise<State>,
): (state: State, payload: Payload) => Promise<State> {
  return async (state, payload) => (await safely(() => action(state, payload))) ?? state;
}
