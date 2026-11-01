import { ScreenError } from './screen-error';

/** 何を求めて断られたか。画像で配信するときはマイクだけを求めるので、カメラの話をしない */
export type CaptureKind = 'camera' | 'mic';

/**
 * カメラとマイクが取れなかった理由を、画面に出す文の鍵にする。
 * ブラウザの出す文（英語の Permission denied など）は、配信する人には何をすればよいか分からないため
 * https://developer.mozilla.org/docs/Web/API/MediaDevices/getUserMedia#exceptions
 */
export function captureError(error: unknown, kind: CaptureKind): ScreenError {
  const name = error instanceof Error ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new ScreenError(kind === 'camera' ? 'cameraDenied' : 'micDenied');
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new ScreenError(kind === 'camera' ? 'cameraMissing' : 'micMissing');
    case 'NotReadableError':
    case 'AbortError':
      return new ScreenError(kind === 'camera' ? 'cameraBusy' : 'micBusy');
    default:
      return new ScreenError(kind === 'camera' ? 'cameraFailed' : 'micFailed');
  }
}
