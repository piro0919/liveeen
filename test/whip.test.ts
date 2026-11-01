import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  afterConnectionChange,
  captureCamera,
  captureChosenMicrophone,
  captureMicrophone,
  publishEnded,
  setVoiceMuted,
} from '@/lib/whip';

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

describe('選んだマイクで取る', () => {
  const stream = {} as MediaStream;

  function stubCapture(
    getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
  ) {
    const spy = vi.fn(getUserMedia);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: spy } });
    return spy;
  }

  afterEach(() => vi.unstubAllGlobals());

  it('選んだマイクを exact で頼む', async () => {
    const spy = stubCapture(() => Promise.resolve(stream));
    await captureMicrophone('usb');
    expect(spy.mock.calls).toEqual([[{ audio: { deviceId: { exact: 'usb' } } }]]);
  });

  it('始めるときは、取れなければ既定のマイクで取り直す', async () => {
    const spy = stubCapture((constraints) =>
      constraints.audio === true
        ? Promise.resolve(stream)
        : Promise.reject(new DOMException('', 'OverconstrainedError')),
    );
    expect(await captureMicrophone('usb')).toBe(stream);
    expect(spy.mock.calls.at(-1)).toEqual([{ audio: true }]);
  });

  it('許可が無ければ、取り直さず許可の理由で断る', async () => {
    const spy = stubCapture(() => Promise.reject(new DOMException('', 'NotAllowedError')));
    await expect(captureMicrophone('usb')).rejects.toMatchObject({ key: 'micDenied' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('カメラを外していても、既定のカメラで取り直す', async () => {
    const spy = stubCapture((constraints) =>
      (constraints.video as MediaTrackConstraints).deviceId
        ? Promise.reject(new DOMException('', 'OverconstrainedError'))
        : Promise.resolve(stream),
    );
    expect(await captureCamera({ deviceId: { exact: 'gone' } })).toBe(stream);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('カメラの許可が無ければ、取り直さず許可の理由で断る', async () => {
    const spy = stubCapture(() => Promise.reject(new DOMException('', 'NotAllowedError')));
    await expect(captureCamera({ deviceId: { exact: 'a' } }, 'usb')).rejects.toMatchObject({
      key: 'cameraDenied',
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('選び直すときは、既定へ移らず投げる', async () => {
    const spy = stubCapture(() => Promise.reject(new DOMException('', 'OverconstrainedError')));
    await expect(captureChosenMicrophone('usb')).rejects.toBeDefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
