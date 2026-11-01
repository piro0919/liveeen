import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * サーバーの決まりを確かめる（jumps-lab の同じ名前のテストを写した）。どれも破っても型検査も lint も通ったまま、本番でだけ壊れる:
 * - Server Action が押した人を自分で確かめないと、運営の操作（配信を止める）を誰でも呼べる
 * - "use server" のファイルが同期の関数を export すると、読み込むページが 500 で落ちる
 * - 鍵（環境変数）を読むファイルがブラウザの束に入ると、値が undefined になる
 */

const ROOT = join(import.meta.dirname, '..', 'src');
const files = readdirSync(ROOT, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({ path: f, source: readFileSync(join(ROOT, f), 'utf8') }));

/** 注釈を落とした中身 */
const shown = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const isUseServer = (source: string) => /^\s*['"]use server['"]/.test(shown(source));
const serverFiles = files.filter((f) => isUseServer(f.source));

describe('Server Action', () => {
  /** export された action と、その本体（関数の閉じ括弧まで） */
  const actions = serverFiles.flatMap(({ path, source }) =>
    [...source.matchAll(/^export async function ([^\s(<]+)/gm)].map((m) => {
      const rest = source.slice(m.index);
      const close = rest.indexOf('\n}\n');
      return {
        path,
        name: m[1] ?? '',
        body: shown(close === -1 ? rest : rest.slice(0, close)),
      };
    }),
  );

  /** 確かめなくてよいもの（理由つき）。見るのにログインは要らないので、見る画面が使う読むだけのものは誰でも聞ける */
  const exempt: Record<string, string> = {
    channelPublishingAction: '配信中かを答えるだけ',
    viewingCapAction: '上限に届いたかを答えるだけ',
  };

  it('action を拾えている（拾い方が壊れて 0 件で通らないように）', () => {
    expect(actions.length).toBeGreaterThanOrEqual(30);
  });

  it('押した人を自分で確かめている', () => {
    const loose = actions
      .filter((action) => !(action.name in exempt))
      .filter((action) => !/\b(currentUserId|requireAdmin)\(/.test(action.body))
      .map((action) => `${action.path}: ${action.name}`);
    expect(loose).toEqual([]);
  });

  it('運営の操作は requireAdmin で確かめている', () => {
    const admin = actions.filter((action) => action.path.startsWith('app/admin/'));
    expect(admin.length).toBeGreaterThanOrEqual(4);
    expect(admin.filter((action) => !action.body.includes('requireAdmin('))).toEqual([]);
  });
});

describe('"use server" のファイル', () => {
  /** async でない export（型だけの export は実行時に出てこないので外す） */
  const syncExports = (source: string): string[] =>
    [...shown(source).matchAll(/^export\s+[^\n]*/gm)]
      .map(([line]) => line.trim())
      .filter((line) => !/^export\s+(?:default\s+)?async\s+function\b/.test(line))
      .filter((line) => !/^export\s+type\b/.test(line));

  it('export は全部 async', () => {
    expect(serverFiles.length).toBeGreaterThanOrEqual(4);
    expect(
      serverFiles.flatMap(({ path, source }) =>
        syncExports(source).map((line) => `${path}: ${line}`),
      ),
    ).toEqual([]);
  });

  it('同期の export を見せたら拾える（物差しを先に疑う）', () => {
    expect(syncExports("'use server';\nexport function helper() {}\n")).toEqual([
      'export function helper() {}',
    ]);
    expect(syncExports("'use server';\nexport async function act() {}\n")).toEqual([]);
  });
});

describe('鍵を読むファイル', () => {
  const readsEnv = (source: string) => shown(source).includes("from '@/env'");

  it('server-only を読み込んでいる（page と route はもともとサーバーだけ）', () => {
    const reading = files.filter((file) => readsEnv(file.source));
    expect(reading.length).toBeGreaterThanOrEqual(5);
    const loose = reading
      .filter(({ path }) => path.startsWith('lib/'))
      .filter(({ source }) => !shown(source).includes("'server-only'"))
      .map(({ path }) => path);
    expect(loose).toEqual([]);
  });
});
