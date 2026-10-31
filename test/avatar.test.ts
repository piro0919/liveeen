import { describe, expect, it } from 'vitest';
import { avatarSrc, sniffAvatarImage, uploadedAvatarPath } from '@/lib/avatar';

const GOOGLE = 'https://lh3.googleusercontent.com/a/photo=s96-c';

describe('avatarSrc', () => {
  it('既定は Google の写真', () => {
    expect(avatarSrc({ choice: 'google', googleImage: GOOGLE, key: null })).toBe(GOOGLE);
  });

  it('Google の写真が無いか https でなければ、名前の1文字（null）', () => {
    expect(avatarSrc({ choice: 'google', googleImage: null, key: null })).toBeNull();
    expect(
      avatarSrc({ choice: 'google', googleImage: 'javascript:alert(1)', key: null }),
    ).toBeNull();
    expect(
      avatarSrc({ choice: 'google', googleImage: 'http://example.com/a', key: null }),
    ).toBeNull();
  });

  it('名前の1文字を選べば、Google の写真があっても null', () => {
    expect(avatarSrc({ choice: 'initial', googleImage: GOOGLE, key: null })).toBeNull();
  });

  it('アップロードした画像は、Google の写真より先に出す', () => {
    expect(avatarSrc({ choice: 'upload', googleImage: GOOGLE, key: 'k1' })).toBe('/api/avatar/k1');
  });
});

describe('uploadedAvatarPath', () => {
  it('住所に使えない文字を逃がす', () => {
    expect(uploadedAvatarPath('a/b?c')).toBe('/api/avatar/a%2Fb%3Fc');
  });
});

describe('sniffAvatarImage', () => {
  const bytes = (...values: number[]) => new Uint8Array(values);

  it('WebP・JPEG・PNG を頭のバイトで見分ける', () => {
    const webp = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50);
    expect(sniffAvatarImage(webp)).toBe('image/webp');
    expect(sniffAvatarImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffAvatarImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(
      'image/png',
    );
  });

  it('ほかのもの（SVG や RIFF の別の形式）は断る', () => {
    expect(sniffAvatarImage(new TextEncoder().encode('<svg xmlns='))).toBeNull();
    const wave = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45);
    expect(sniffAvatarImage(wave)).toBeNull();
    expect(sniffAvatarImage(bytes())).toBeNull();
  });
});
