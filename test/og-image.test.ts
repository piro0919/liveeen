import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { darkPalette } from '@/lib/og-image';

const css = readFileSync(join(import.meta.dirname, '..', 'src/app/globals.css'), 'utf8');

describe('共有の画像の色', () => {
  it('globals.css の暗い方の色を読む（明るい方ではない）', () => {
    expect(darkPalette(css)).toEqual({
      background: '#0c0d12',
      foreground: '#f2f3f7',
      muted: '#9a9fb0',
      accentFill: '#e11d55',
    });
  });

  it('色が欠けていれば名前を挙げて止まる', () => {
    expect(() =>
      darkPalette('@media (prefers-color-scheme: dark) { :root { --background: x; } }'),
    ).toThrow('--foreground');
  });
});
