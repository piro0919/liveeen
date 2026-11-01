import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * loading.tsx があると、ページの中身より先に状態 200 が出るので、notFound() が 404 を返せなくなる（smooo で起きた）。
 * 無い住所を 404 で返す配信者のページ（[channelId]）と運営の画面（/admin）、転送する画面を覆う場所には置かない
 */
const APP = join(import.meta.dirname, '..', 'src', 'app');

const loadingFiles = readdirSync(APP, { recursive: true, encoding: 'utf8' }).filter((file) =>
  /(^|\/)loading\.tsx$/.test(file),
);

describe('loading.tsx の置き場所', () => {
  it('拾えている（拾い方が壊れて 0 件で通らないように）', () => {
    expect(loadingFiles).toContain('(home)/loading.tsx');
  });

  it('404 を返す画面の上に無い', () => {
    // /broadcast/obs は、ログインしていなければ /broadcast へ転送する。覆うと転送が 200 の上の meta refresh になり、1秒待たされる
    const covering = [
      'loading.tsx',
      '[channelId]/loading.tsx',
      'admin/loading.tsx',
      'broadcast/loading.tsx',
    ];
    expect(covering.filter((file) => existsSync(join(APP, file)))).toEqual([]);
  });

  it('見ている場所に、配信者のページと運営の画面がいまもある', () => {
    expect(existsSync(join(APP, '[channelId]', 'page.tsx'))).toBe(true);
    expect(existsSync(join(APP, 'admin', 'page.tsx'))).toBe(true);
  });
});
