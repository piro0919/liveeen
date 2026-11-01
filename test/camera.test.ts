import { describe, expect, it } from 'vitest';
import { cameraAttempts, firstCamera, knownCameraCount } from '@/lib/camera';

const camera = (deviceId: string, label = 'カメラ') => ({
  kind: 'videoinput' as const,
  deviceId,
  label,
});
const microphone = { kind: 'audioinput' as const, deviceId: 'mic', label: 'マイク' };

describe('knownCameraCount', () => {
  it('名前が読めるときはカメラだけを数える', () => {
    expect(knownCameraCount([camera('a'), camera('b'), microphone])).toBe(2);
  });

  it('許可を得る前（名前が読めない）は分からないとする', () => {
    expect(knownCameraCount([camera('', ''), microphone])).toBeNull();
    expect(knownCameraCount([])).toBeNull();
  });
});

describe('cameraAttempts', () => {
  const devices = [camera('a'), camera('b'), camera('c'), microphone];
  const exact = (deviceId: string) => ({ deviceId: { exact: deviceId } });

  it('前面なら背面を先に試し、その次に一覧の次のカメラを試す', () => {
    expect(cameraAttempts({ deviceId: 'a', facingMode: 'user' }, devices)).toEqual([
      { facingMode: { exact: 'environment' } },
      exact('b'),
      exact('c'),
    ]);
  });

  it('背面なら前面を先に試す', () => {
    expect(cameraAttempts({ deviceId: 'b', facingMode: 'environment' }, devices)[0]).toEqual({
      facingMode: { exact: 'user' },
    });
  });

  it('向きが分からなければ、一覧の次から順に一周し、今のカメラは入れない', () => {
    expect(cameraAttempts({ deviceId: 'b' }, devices)).toEqual([exact('c'), exact('a')]);
    expect(cameraAttempts({ deviceId: 'c' }, devices)).toEqual([exact('a'), exact('b')]);
  });

  it('今のカメラが一覧に無ければ、全部を試す', () => {
    expect(cameraAttempts({}, devices)).toEqual([exact('a'), exact('b'), exact('c')]);
  });
});

describe('firstCamera', () => {
  const track = { id: 'found' } as MediaStreamTrack;
  const withTrack = { getVideoTracks: () => [track] } as unknown as MediaStream;

  it('取れなかったカメラを飛ばして、最初に取れた映像を返す', async () => {
    const tried: unknown[] = [];
    const found = await firstCamera(
      [{ facingMode: 'a' }, { facingMode: 'b' }, { facingMode: 'c' }],
      (choice) => {
        tried.push(choice.facingMode);
        return choice.facingMode === 'b'
          ? Promise.resolve(withTrack)
          : Promise.reject(new Error('取れない'));
      },
    );
    expect(found).toBe(track);
    expect(tried).toEqual(['a', 'b']);
  });

  it('どれも取れなければ null', async () => {
    await expect(
      firstCamera([{ facingMode: 'a' }], () => Promise.reject(new Error('取れない'))),
    ).resolves.toBeNull();
  });
});
