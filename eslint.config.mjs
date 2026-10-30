import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import magicNumbers from '@piro0919/eslint-config';
import tailwind from '@piro0919/eslint-config/tailwind';
import hollowTests from 'eslint-plugin-hollow-tests';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // 決まりは全リポジトリで共有する（piro0919/eslint-config）。[...] に値をじかに書かず、globals.css の @theme に名前を付けて使う
  ...tailwind({
    cssConfigPath: 'src/app/globals.css',
    files: ['src/**/*.{ts,tsx}'],
    level: 'error',
  }),
  // 名前の無い数字を落とす（piro0919/eslint-config）
  ...magicNumbers({ files: ['src/**/*.{ts,tsx}'], level: 'error' }),
  // 何も確かめずに通るテスト（確かめる文が無い・条件の中にしか無い）を落とす
  { ...hollowTests.configs.recommended, files: ['test/**/*.{ts,tsx}'] },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // 別のセッションの作業用のコピー（git worktree）
    '.claude/**',
    '.playwright-mcp/**',
  ]),
]);

export default eslintConfig;
