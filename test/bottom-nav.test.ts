import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isActiveTab, showsBottomNav } from '@/lib/bottom-nav';

describe('showsBottomNav', () => {
  it('src/app の画面はどれも出す道に入っている', () => {
    const app = join(process.cwd(), 'src/app');
    const pages = readdirSync(app, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('['))
      .map((e) => e.name)
      .filter((name) => existsSync(join(app, name, 'page.tsx')));
    expect(pages.length).toBeGreaterThan(0);
    for (const name of pages) expect(showsBottomNav(`/${name}`), name).toBe(true);
  });

  it('トップとサイトの道には出す', () => {
    for (const path of [
      '/',
      '/search',
      '/following',
      '/broadcast',
      '/broadcast/obs',
      '/settings',
    ]) {
      expect(showsBottomNav(path)).toBe(true);
    }
  });

  it('見る画面には出さない', () => {
    expect(showsBottomNav('/@piro2')).toBe(false);
    expect(showsBottomNav('/%40piro2')).toBe(false);
    expect(showsBottomNav('/XtWf2v9zuMNZ')).toBe(false);
  });
});

describe('isActiveTab', () => {
  it('ホームはトップのときだけ', () => {
    expect(isActiveTab('/', '/')).toBe(true);
    expect(isActiveTab('/search', '/')).toBe(false);
  });

  it('下の階層も同じタブにする', () => {
    expect(isActiveTab('/broadcast', '/broadcast')).toBe(true);
    expect(isActiveTab('/broadcast/obs', '/broadcast')).toBe(true);
  });

  it('名前の頭が同じだけの道は別のタブ', () => {
    expect(isActiveTab('/searching', '/search')).toBe(false);
  });
});
