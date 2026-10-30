import { describe, expect, it } from 'vitest';
import { ipKeyOf } from '@/lib/ip-key';

const SECRET = 'ip-secret';

describe('ipKeyOf', () => {
  it('同じ IPv4 は同じ鍵、違えば違う鍵', () => {
    expect(ipKeyOf(SECRET, '203.0.113.1')).toBe(ipKeyOf(SECRET, '203.0.113.1'));
    expect(ipKeyOf(SECRET, '203.0.113.1')).not.toBe(ipKeyOf(SECRET, '203.0.113.2'));
  });

  it('IPv6 は頭の 64 ビットが同じなら同じ鍵', () => {
    const key = ipKeyOf(SECRET, '2001:db8:1:2::1');
    expect(ipKeyOf(SECRET, '2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd')).toBe(key);
    expect(ipKeyOf(SECRET, '2001:db8:1:3::1')).not.toBe(key);
  });

  it('IPv4 を包んだ IPv6 は IPv4 と同じ鍵', () => {
    expect(ipKeyOf(SECRET, '::ffff:203.0.113.1')).toBe(ipKeyOf(SECRET, '203.0.113.1'));
  });

  it('鍵が違えば別の値になり、IP でなければ null', () => {
    expect(ipKeyOf('other', '203.0.113.1')).not.toBe(ipKeyOf(SECRET, '203.0.113.1'));
    expect(ipKeyOf(SECRET, 'unknown')).toBeNull();
  });
});
