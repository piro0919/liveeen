import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { darkPalette, headingSize } from '@/lib/og-image';

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

describe('共有の画像の見出しの大きさ', () => {
  it('見た目の文字数で数える。絵文字や𠮷の入った12字は短い見出しのまま', () => {
    expect(headingSize('配信中'.padEnd(12, '字'))).toBe(76);
    expect(headingSize('👨‍👩‍👧‍👦𠮷'.repeat(6))).toBe(76);
  });

  it('長くなるほど小さくする', () => {
    expect(headingSize('字'.repeat(13))).toBe(60);
    expect(headingSize('字'.repeat(31))).toBe(48);
  });
});
