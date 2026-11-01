import { afterEach, describe, expect, it, vi } from 'vitest';
import { whenVisible } from '@/lib/when-visible';

function stubDocument(visibilityState: string) {
  const listeners = new Set<() => void>();
  const stub = {
    visibilityState,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    show() {
      stub.visibilityState = 'visible';
      for (const listener of [...listeners]) listener();
    },
    listeners,
  };
  vi.stubGlobal('document', stub);
  return stub;
}

afterEach(() => vi.unstubAllGlobals());

describe('whenVisible', () => {
  it('見えていれば、すぐ呼ぶ', () => {
    stubDocument('visible');
    const run = vi.fn();
    whenVisible(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('裏にあれば、前に戻ったときに一度だけ呼ぶ', () => {
    const page = stubDocument('hidden');
    const run = vi.fn();
    whenVisible(run);
    expect(run).not.toHaveBeenCalled();
    page.show();
    page.show();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('やめたら呼ばない', () => {
    const page = stubDocument('hidden');
    const run = vi.fn();
    whenVisible(run)();
    page.show();
    expect(run).not.toHaveBeenCalled();
    expect(page.listeners.size).toBe(0);
  });
});
