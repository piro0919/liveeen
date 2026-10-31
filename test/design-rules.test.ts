import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 見た目の決まり（CLAUDE.md の Design rules）から外れた書き方を見つける。
 * ボタンや色をその場で書き起こすと、少しずつ違う形が増えるため。決まりを変えるときは、ここも一緒に変える
 */

const ROOT = join(import.meta.dirname, '..', 'src');
const files = readdirSync(ROOT, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.(tsx|ts)$/.test(f))
  .map((f) => ({ path: f, lines: readFileSync(join(ROOT, f), 'utf8').split('\n') }));

/** 行からコメントを除く。同じ行のコメントの後ろに書いた決まり違いも見逃さないよう、行ごとは飛ばさない */
function withoutComments(line: string): string {
  return line
    .replace(/\{\/\*.*?\*\/\}/g, '')
    .replace(/\/\*.*?\*\//g, '')
    .replace(/^\s*\*.*$/, '')
    .replace(/(^|\s)\/\/.*$/, '');
}

/** 決まりに合わない行を「ファイル:行」で集める。コメントは見ない */
function offenders(test: (line: string) => boolean, allow: string[] = []): string[] {
  return files.flatMap(({ path, lines }) =>
    allow.includes(path)
      ? []
      : lines.flatMap((line, i) => (!test(withoutComments(line)) ? [] : [`${path}:${i + 1}`])),
  );
}

describe('見た目の決まり', () => {
  it('色の値を部品に書かない（globals.css の色の名前を使う）', () => {
    expect(offenders((l) => /(?<!href=)["'\s:[(]#[0-9a-fA-F]{3,8}\b/.test(l))).toEqual([]);
  });

  it('Tailwind の色（gray-500 など）を使わない（globals.css の色の名前を使う）', () => {
    expect(
      offenders((l) =>
        /\b(?:text|bg|border|ring|outline|accent|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d/.test(
          l,
        ),
      ),
    ).toEqual([]);
  });

  it('丸いボタンの形は src/lib/ui.ts にだけ書く（人の印は例外）', () => {
    expect(
      offenders((l) => /\brounded-full\b/.test(l), ['lib/ui.ts', 'components/avatar.tsx']),
    ).toEqual([]);
  });

  it('黒と白は src/lib/ui.ts にだけ書く（映像の枠とライブの札）', () => {
    expect(
      offenders((l) => /\b(?:bg|text|border)-(?:black|white)\b/.test(l), ['lib/ui.ts']),
    ).toEqual([]);
  });

  it('前の素の枠のボタン（rounded border px-…）を使わない', () => {
    expect(offenders((l) => /rounded border px-/.test(l))).toEqual([]);
  });
});
