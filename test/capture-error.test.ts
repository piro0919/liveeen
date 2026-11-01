import { describe, expect, it } from 'vitest';
import { captureError } from '@/lib/capture-error';

const failure = (name: string) => Object.assign(new Error('browser text'), { name });

describe('captureError', () => {
  it('断られたら、許可の出し直しを案内する文にする', () => {
    expect(captureError(failure('NotAllowedError'), 'camera').key).toBe('cameraDenied');
    expect(captureError(failure('NotAllowedError'), 'mic').key).toBe('micDenied');
    expect(captureError(failure('SecurityError'), 'camera').key).toBe('cameraDenied');
  });

  it('機器が無ければ、無いと言う', () => {
    expect(captureError(failure('NotFoundError'), 'camera').key).toBe('cameraMissing');
    expect(captureError(failure('NotFoundError'), 'mic').key).toBe('micMissing');
    expect(captureError(failure('OverconstrainedError'), 'camera').key).toBe('cameraMissing');
  });

  it('ほかのアプリが使っていれば、そう言う', () => {
    expect(captureError(failure('NotReadableError'), 'camera').key).toBe('cameraBusy');
    expect(captureError(failure('AbortError'), 'mic').key).toBe('micBusy');
  });

  it('知らない失敗でも、ブラウザの文をそのまま出さない', () => {
    expect(captureError(failure('SomethingNew'), 'camera').key).toBe('cameraFailed');
    expect(captureError('text', 'mic').key).toBe('micFailed');
  });
});
