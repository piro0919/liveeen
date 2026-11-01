import { describe, expect, it } from 'vitest';
import { afterConnectionChange, publishEnded, setVoiceMuted } from '@/lib/whip';

describe('publishEnded', () => {
  it('配信が届いていなければ、終わった', () => {
    expect(publishEnded(false, 'me')).toBe(true);
    expect(publishEnded(false, null)).toBe(true);
  });

  it('別のつなぎが届けていれば、取られたので終わった', () => {
    expect(publishEnded('other', 'me')).toBe(true);
  });

  it('自分が届けているか、分からないなら、終わったと決めない', () => {
    expect(publishEnded('me', 'me')).toBe(false);
    expect(publishEnded(null, 'me')).toBe(false);
    expect(publishEnded('other', null)).toBe(false);
  });
});

describe('setVoiceMuted', () => {
  it('マイクの音を無音にし、戻せる', () => {
    const voice = { enabled: true } as MediaStreamTrack;
    const stream = { getAudioTracks: () => [voice] };
    setVoiceMuted(stream, true);
    expect(voice.enabled).toBe(false);
    setVoiceMuted(stream, false);
    expect(voice.enabled).toBe(true);
  });
});

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
