import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const order: string[] = [];
const deleteRow = vi.fn<(endpoint: string) => Promise<true>>();
const authSignOut = vi.fn<() => Promise<{ error: unknown }>>();
vi.mock('@/app/settings/actions', () => ({ deletePushSubscriptionAction: deleteRow }));
vi.mock('@/lib/auth-client', () => ({ signOut: authSignOut }));

const { dropBrowserPush, signOut } = await import('@/lib/sign-out');

function stubBrowser(subscribed: boolean) {
  const subscription = {
    endpoint: 'https://push.example/1',
    unsubscribe: vi.fn(() => {
      order.push('unsubscribe');
      return Promise.resolve(true);
    }),
  };
  vi.stubGlobal('navigator', {
    serviceWorker: {
      getRegistration: () =>
        Promise.resolve({
          pushManager: { getSubscription: () => Promise.resolve(subscribed ? subscription : null) },
        }),
    },
  });
  return subscription;
}

beforeEach(() => {
  order.length = 0;
  deleteRow.mockReset();
  deleteRow.mockImplementation(() => {
    order.push('delete');
    return Promise.resolve(true);
  });
  authSignOut.mockReset();
  authSignOut.mockImplementation(() => {
    order.push('signOut');
    return Promise.resolve({ error: null });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('signOut', () => {
  it('ログアウトの前に、購読を外して行を消す（行を消すにはログインが要る）', async () => {
    stubBrowser(true);
    expect(await signOut()).toEqual({ error: null });
    expect(order).toEqual(['unsubscribe', 'delete', 'signOut']);
    expect(deleteRow).toHaveBeenCalledWith('https://push.example/1');
  });

  it('通知を入れていなければ、そのままログアウトする', async () => {
    stubBrowser(false);
    await signOut();
    expect(order).toEqual(['signOut']);
  });

  it('service worker の無いブラウザでもログアウトできる', async () => {
    vi.stubGlobal('navigator', {});
    await signOut();
    expect(order).toEqual(['signOut']);
  });

  it('行を消せなくてもログアウトする', async () => {
    stubBrowser(true);
    deleteRow.mockRejectedValue(new Error('offline'));
    await signOut();
    expect(order).toEqual(['unsubscribe', 'signOut']);
  });

  it('行を消す答えが返らなくても、3秒でログアウトへ進む', async () => {
    vi.useFakeTimers();
    stubBrowser(true);
    deleteRow.mockReturnValue(new Promise(() => undefined));
    const done = signOut();
    await vi.advanceTimersByTimeAsync(2999);
    expect(order).toEqual(['unsubscribe']);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(order).toEqual(['unsubscribe', 'signOut']);
  });

  it('ログアウトの失敗は投げずに返す', async () => {
    stubBrowser(false);
    authSignOut.mockRejectedValue(new Error('offline'));
    expect(await signOut()).toEqual({ error: true });
  });
});

describe('dropBrowserPush', () => {
  it('購読だけを外す', async () => {
    const subscription = stubBrowser(true);
    await dropBrowserPush();
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(deleteRow).not.toHaveBeenCalled();
  });
});
