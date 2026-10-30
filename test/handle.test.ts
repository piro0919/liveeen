import { describe, expect, it } from 'vitest';
import { channelPath, handleOfSegment, normalizeHandle } from '@/lib/handle';

describe('normalizeHandle', () => {
  it('前後の空白を落とし、大文字は小文字にそろえる', () => {
    expect(normalizeHandle('  Piro_0919 ')).toEqual({ ok: true, handle: 'piro_0919' });
  });

  it('3文字から20文字まで', () => {
    expect(normalizeHandle('ab').ok).toBe(false);
    expect(normalizeHandle('abc').ok).toBe(true);
    expect(normalizeHandle('a'.repeat(20)).ok).toBe(true);
    expect(normalizeHandle('a'.repeat(21)).ok).toBe(false);
  });

  it('英小文字・数字・_ 以外は使えない', () => {
    for (const input of ['ab-c', 'ab.c', 'ab c', 'あいう', 'abc!', 'ａｂｃ']) {
      expect(normalizeHandle(input).ok).toBe(false);
    }
  });

  it('サイトの道と同じ名前は使えない', () => {
    for (const input of ['admin', 'API', 'broadcast', 'settings']) {
      expect(normalizeHandle(input)).toEqual({ ok: false, error: 'このハンドルは使えません' });
    }
  });
});

describe('channelPath', () => {
  it('ハンドルがあれば /@ハンドル', () => {
    expect(channelPath({ id: 'XtWf2v9zuMNZ', handle: 'piro' })).toBe('/@piro');
  });

  it('まだ無ければチャンネルの id', () => {
    expect(channelPath({ id: 'XtWf2v9zuMNZ', handle: null })).toBe('/XtWf2v9zuMNZ');
  });
});

describe('handleOfSegment', () => {
  it('@ で始まればハンドル。%40 で届いても同じ', () => {
    expect(handleOfSegment('@piro')).toBe('piro');
    expect(handleOfSegment('%40piro')).toBe('piro');
  });

  it('大文字で打たれた住所も小文字にそろえる', () => {
    expect(handleOfSegment('@Piro')).toBe('piro');
  });

  it('チャンネルの id なら null', () => {
    expect(handleOfSegment('XtWf2v9zuMNZ')).toBe(null);
  });
});
