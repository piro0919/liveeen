import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

const source = readFileSync(join(import.meta.dirname, '..', 'public', 'sw.js'), 'utf8');

type Shown = { title: string; options: Record<string, unknown> };
let shown: Shown[];
let pushListener: (event: unknown) => void;

beforeEach(() => {
  shown = [];
  const self = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      if (type === 'push') pushListener = listener;
    },
    registration: {
      showNotification: (title: string, options: Record<string, unknown>) => {
        shown.push({ title, options });
        return Promise.resolve();
      },
    },
    location: { origin: 'https://liveeen.example' },
  };
  runInNewContext(source, { self, URL });
});

function push(data: unknown) {
  pushListener({ data, waitUntil: () => undefined });
}

describe('public/sw.js', () => {
  it('届いた中身を、印を付けて出す', () => {
    push({ json: () => ({ title: 'A さんが配信を始めました', body: '見る', url: '/@a' }) });
    expect(shown).toHaveLength(1);
    expect(shown[0]?.title).toBe('A さんが配信を始めました');
    expect(shown[0]?.options).toMatchObject({
      body: '見る',
      tag: '/@a',
      renotify: true,
      icon: '/icon-192x192.png',
      badge: '/notification-badge.png',
      data: { url: '/@a' },
    });
  });

  it('url の無い中身でも、まとめる印を空にしない（空だと renotify で投げる）', () => {
    push({ json: () => ({ title: 'お知らせ' }) });
    expect(shown[0]?.options).toMatchObject({ tag: '/', renotify: true, data: { url: '/' } });
  });

  it.each([
    ['中身が無い', null],
    [
      '読めない中身',
      {
        json: () => {
          throw new SyntaxError('bad');
        },
      },
    ],
    ['題の無い中身', { json: () => ({}) }],
  ])('%s でも通知を出す', (_, data) => {
    push(data);
    expect(shown).toHaveLength(1);
    expect(shown[0]?.title).toBe('Liveeen');
    expect(shown[0]?.options).toMatchObject({ data: { url: '/' } });
  });
});
