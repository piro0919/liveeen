import { describe, expect, it } from 'vitest';
import { afterConnectionChange } from '@/lib/whip';

describe('afterConnectionChange', () => {
  it('failed は戻らないので、配信が切れたとみなす', () => {
    expect(afterConnectionChange('failed')).toBe('ended');
  });

  it('disconnected は戻ることがあるので、配信サーバーに聞く', () => {
    expect(afterConnectionChange('disconnected')).toBe('ask');
  });

  it('つながっている間と、自分で閉じたときは何もしない', () => {
    expect(afterConnectionChange('connected')).toBe('keep');
    expect(afterConnectionChange('closed')).toBe('keep');
  });
});
