import { createHmac } from 'node:crypto';
import { isIPv4, isIPv6 } from 'node:net';

/** IPv6 は回線ごとに /64 を渡されて、その中で住所を替えられるので、頭の 64 ビットで見る */
const IPV6_PREFIX_GROUPS = 4;
const IPV6_GROUPS = 8;
const IPV4_MAPPED = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;
const HEX = 16;

/** 同じ回線を同じ形にする。IPv4 はそのまま、IPv6 は頭の 64 ビット。IP でなければ null */
function networkOf(ip: string): string | null {
  const mapped = IPV4_MAPPED.exec(ip)?.[1];
  if (mapped) return mapped;
  if (isIPv4(ip)) return ip;
  if (!isIPv6(ip)) return null;
  const [head = '', tail = ''] = ip.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const zeros = Array<string>(IPV6_GROUPS - headGroups.length - tailGroups.length).fill('0');
  const groups = ip.includes('::') ? [...headGroups, ...zeros, ...tailGroups] : headGroups;
  return groups
    .slice(0, IPV6_PREFIX_GROUPS)
    .map((group) => Number.parseInt(group, HEX).toString(HEX))
    .join(':');
}

/**
 * コメントした人の IP を、ブロックに使う鍵にする（CLAUDE.md の Comments）。
 * IP そのものは誰にも見せないので、署名の鍵で混ぜた値だけを札とブロックの表に持つ。IP でなければ null
 */
export function ipKeyOf(secret: string, ip: string): string | null {
  const network = networkOf(ip.trim());
  if (!network) return null;
  return createHmac('sha256', secret).update(`ip:${network}`).digest('base64url');
}
