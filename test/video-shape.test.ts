import { describe, expect, it } from 'vitest';
import { shapeChanged } from '@/lib/video-shape';

const size = (width: number, height: number) => ({ width, height });

describe('shapeChanged', () => {
  it('スマホの向きが変わったら、変わったと見る', () => {
    expect(shapeChanged(size(720, 1280), size(1280, 720))).toBe(true);
    expect(shapeChanged(size(640, 360), size(360, 640))).toBe(true);
  });

  it('比が 4:3 のカメラへ移ったら、変わったと見る', () => {
    expect(shapeChanged(size(1280, 720), size(640, 480))).toBe(true);
  });

  it('回線に合わせて解像度が変わっただけなら、変わっていないと見る', () => {
    expect(shapeChanged(size(640, 360), size(1280, 720))).toBe(false);
    expect(shapeChanged(size(1280, 720), size(480, 270))).toBe(false);
    expect(shapeChanged(size(1280, 720), size(426, 240))).toBe(false);
  });

  it('映像の大きさがまだ分からないときは、変わっていないと見る', () => {
    expect(shapeChanged(size(0, 0), size(1280, 720))).toBe(false);
    expect(shapeChanged(size(1280, 720), size(0, 0))).toBe(false);
  });
});
