/**
 * カメラの台数。許可を得る前のブラウザは台数を正しく教えないので、名前が読めるときだけ数える。
 * 分からなければ null
 */
export function knownCameraCount(
  devices: readonly Pick<MediaDeviceInfo, 'kind' | 'label'>[],
): number | null {
  const cameras = devices.filter((device) => device.kind === 'videoinput');
  return cameras.some((camera) => camera.label) ? cameras.length : null;
}

/** 端末のカメラの一覧。読めない環境（アプリの中のブラウザなど）では空 */
export async function listDevices(): Promise<MediaDeviceInfo[]> {
  if (!('mediaDevices' in navigator)) return [];
  return navigator.mediaDevices.enumerateDevices().catch(() => []);
}

/**
 * 次のカメラの取り方を、試す順に並べる。
 * スマホは背面だけで何台もあるので、向きが分かれば反対の向きを先に試す（前面と背面の切り替えになる）。
 * 反対の向きが無ければ、一覧の次のカメラから順に試す（パソコンにつないだカメラ）
 */
export function cameraAttempts(
  now: { deviceId?: string; facingMode?: string },
  devices: readonly Pick<MediaDeviceInfo, 'kind' | 'deviceId'>[],
): MediaTrackConstraints[] {
  const ids = devices
    .filter((device) => device.kind === 'videoinput' && device.deviceId)
    .map((device) => device.deviceId);
  const index = now.deviceId === undefined ? -1 : ids.indexOf(now.deviceId);
  const others = [...ids.slice(index + 1), ...ids.slice(0, Math.max(index, 0))];
  const byDevice = others.map((deviceId) => ({ deviceId: { exact: deviceId } }));
  if (now.facingMode === 'user') return [{ facingMode: { exact: 'environment' } }, ...byDevice];
  if (now.facingMode === 'environment') return [{ facingMode: { exact: 'user' } }, ...byDevice];
  return byDevice;
}

/** 順に試して、最初に取れた映像を返す。どれも取れなければ null */
export async function firstCamera(
  attempts: readonly MediaTrackConstraints[],
  capture: (choice: MediaTrackConstraints) => Promise<MediaStream>,
): Promise<MediaStreamTrack | null> {
  for (const choice of attempts) {
    try {
      const track = (await capture(choice)).getVideoTracks()[0];
      if (track) return track;
    } catch {
      // このカメラは取れなかったので、次を試す
    }
  }
  return null;
}
