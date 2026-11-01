/** 選んだマイクを、このブラウザに覚えておく場所 */
const CHOICE_KEY = 'liveeen.microphone';

/**
 * ブラウザが「既定」として足す項目。実物のマイクと重なるので数えない（Chrome は1台でも default と実物の2行を返す）
 */
const VIRTUAL_IDS = new Set(['default', 'communications']);

export type Microphone = { deviceId: string; label: string };

/** 選べるマイク。許可を得る前のブラウザは名前を教えないので、名前が読めるものだけ返す */
export function knownMicrophones(
  devices: readonly Pick<MediaDeviceInfo, 'kind' | 'deviceId' | 'label'>[],
): Microphone[] {
  return devices
    .filter(
      (device) =>
        device.kind === 'audioinput' && device.label !== '' && !VIRTUAL_IDS.has(device.deviceId),
    )
    .map(({ deviceId, label }) => ({ deviceId, label }));
}

/**
 * マイクの取り方。exact にする。ideal だと Chrome は選んだマイクでなく既定のマイクを返した（2026-11-01、手元で測った）。
 * 選んでいなければブラウザに任せる
 */
export function microphoneConstraints(deviceId: string | null): MediaTrackConstraints | true {
  return deviceId ? { deviceId: { exact: deviceId } } : true;
}

/** 覚えておいたマイク。読めないブラウザでは null */
export function readMicrophoneChoice(): string | null {
  try {
    return localStorage.getItem(CHOICE_KEY);
  } catch {
    return null;
  }
}

export function saveMicrophoneChoice(deviceId: string | null): void {
  try {
    if (deviceId) localStorage.setItem(CHOICE_KEY, deviceId);
    else localStorage.removeItem(CHOICE_KEY);
  } catch {
    // 覚えておけなくても、この配信では使える
  }
}
