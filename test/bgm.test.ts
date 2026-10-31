import { describe, expect, it } from 'vitest';
import { BGM_TRACKS, bgmTrackUrl, nextTrackIndex } from '@/lib/bgm';

describe('nextTrackIndex', () => {
  it('曲が終わったら一覧の次の曲へ進む', () => {
    expect(nextTrackIndex(0)).toBe(1);
  });

  it('最後の曲の次は最初の曲', () => {
    expect(nextTrackIndex(BGM_TRACKS.length - 1)).toBe(0);
  });
});

describe('bgmTrackUrl', () => {
  it('配信サーバーの /bgm の下の m4a を指す', () => {
    expect(bgmTrackUrl('https://media.example/bgm', 'abc')).toBe(
      'https://media.example/bgm/abc.m4a',
    );
  });

  it('住所の末尾の / は重ねない', () => {
    expect(bgmTrackUrl('https://media.example/bgm/', 'abc')).toBe(
      'https://media.example/bgm/abc.m4a',
    );
  });
});

describe('BGM_TRACKS', () => {
  it('同じ曲を2度並べない', () => {
    expect(new Set(BGM_TRACKS.map((track) => track.id)).size).toBe(BGM_TRACKS.length);
  });
});
