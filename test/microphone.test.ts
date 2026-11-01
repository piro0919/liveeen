import { describe, expect, it } from 'vitest';
import { knownMicrophones, microphoneConstraints } from '@/lib/microphone';

const device = (kind: string, deviceId: string, label: string) =>
  ({ kind, deviceId, label }) as MediaDeviceInfo;

describe('knownMicrophones', () => {
  it('実物のマイクだけを返す。Chrome の既定の行は数えない', () => {
    expect(
      knownMicrophones([
        device('audioinput', 'default', '既定 - 内蔵マイク'),
        device('audioinput', 'communications', '通信 - 内蔵マイク'),
        device('audioinput', 'a', '内蔵マイク'),
        device('audioinput', 'b', 'USB マイク'),
        device('videoinput', 'c', 'カメラ'),
        device('audiooutput', 'd', 'スピーカー'),
      ]),
    ).toEqual([
      { deviceId: 'a', label: '内蔵マイク' },
      { deviceId: 'b', label: 'USB マイク' },
    ]);
  });

  it('許可の前で名前が読めなければ、選ばせない', () => {
    expect(
      knownMicrophones([device('audioinput', 'a', ''), device('audioinput', 'b', '')]),
    ).toEqual([]);
  });
});

describe('microphoneConstraints', () => {
  it('選んでいなければブラウザに任せる', () => {
    expect(microphoneConstraints(null)).toBe(true);
  });

  it('選んだマイクを exact で頼む（ideal だと Chrome は既定のマイクを返す）', () => {
    expect(microphoneConstraints('a')).toEqual({ deviceId: { exact: 'a' } });
  });
});
