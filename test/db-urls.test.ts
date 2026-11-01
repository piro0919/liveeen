import { describe, expect, it } from 'vitest';
import { isLocalHost } from './db/urls';

describe('isLocalHost', () => {
  it('手元の Postgres だけを通す', () => {
    expect(isLocalHost('localhost')).toBe(true);
    expect(isLocalHost('127.0.0.1')).toBe(true);
    expect(isLocalHost('[::1]')).toBe(true);
  });

  it('Neon には決してつながない', () => {
    expect(isLocalHost('ep-xxx.ap-southeast-1.aws.neon.tech')).toBe(false);
  });
});
