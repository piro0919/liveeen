import { describe, expect, it } from 'vitest';
import { installChoice } from '@/lib/install';

const NOTHING = {
  canInstall: false,
  isInstalled: false,
  needsManualInstall: false,
  dismissed: false,
};

describe('installChoice', () => {
  it('ブラウザが追加の確認を出せるなら、それを出す', () => {
    expect(installChoice({ ...NOTHING, canInstall: true })).toBe('prompt');
  });

  it('iOS は確認を出せないので、手順を案内する', () => {
    expect(installChoice({ ...NOTHING, needsManualInstall: true })).toBe('guide');
  });

  it('確認をやめた後は出さない（同じ確認はもう出せず、押しても何も起きない）', () => {
    expect(installChoice({ ...NOTHING, canInstall: true, dismissed: true })).toBeNull();
  });

  it('入れた後と、どちらもできない端末では出さない', () => {
    expect(installChoice({ ...NOTHING, canInstall: true, isInstalled: true })).toBeNull();
    expect(installChoice(NOTHING)).toBeNull();
  });
});
