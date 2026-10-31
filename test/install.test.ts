import { describe, expect, it } from 'vitest';
import { installChoice, isAppleDevice } from '@/lib/install';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1';
// iPad の Safari は Mac を名乗る
const IPAD_OR_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36';

describe('isAppleDevice', () => {
  it('iPhone と、触れる Mac（iPad）を iOS とみなす', () => {
    expect(isAppleDevice(IPHONE, 5)).toBe(true);
    expect(isAppleDevice(IPAD_OR_MAC, 5)).toBe(true);
  });

  it('触れない Mac と Android は iOS でない', () => {
    expect(isAppleDevice(IPAD_OR_MAC, 0)).toBe(false);
    expect(isAppleDevice(ANDROID, 5)).toBe(false);
  });
});

describe('installChoice', () => {
  it('ブラウザが追加の確認を出せるなら、それを出す', () => {
    expect(installChoice({ canInstall: true, isInstalled: false, isApple: false })).toBe('prompt');
  });

  it('iOS は確認を出せないので、手順を案内する', () => {
    expect(installChoice({ canInstall: false, isInstalled: false, isApple: true })).toBe('guide');
  });

  it('入れた後と、どちらもできない端末では出さない', () => {
    expect(installChoice({ canInstall: true, isInstalled: true, isApple: true })).toBeNull();
    expect(installChoice({ canInstall: false, isInstalled: false, isApple: false })).toBeNull();
  });
});
