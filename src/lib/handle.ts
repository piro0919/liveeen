/** ハンドルの長さ（CLAUDE.md） */
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

/** 使える形。英小文字・数字・_。db/migrations/0012_handle.sql の歯止めと同じ */
const HANDLE_PATTERN = new RegExp(`^[a-z0-9_]{${HANDLE_MIN},${HANDLE_MAX}}$`);

/** サイトの道と同じ名前。紛らわしいので使わせない（CLAUDE.md） */
const RESERVED = new Set(['admin', 'api', 'broadcast', 'settings']);

/**
 * 本人が入れたハンドルを、保存してよい形にする。前後の空白を落とし、大文字は小文字にそろえる。
 * 使えなければ理由を返す。ほかの人が使っているかは DB で確かめる（src/lib/profiles.ts）
 */
export function normalizeHandle(
  input: string,
): { ok: true; handle: string } | { ok: false; error: string } {
  const handle = input.trim().toLowerCase();
  if (!HANDLE_PATTERN.test(handle)) {
    return {
      ok: false,
      error: `英小文字・数字・_ の${HANDLE_MIN}〜${HANDLE_MAX}文字にしてください`,
    };
  }
  if (RESERVED.has(handle)) return { ok: false, error: 'このハンドルは使えません' };
  return { ok: true, handle };
}

/** 配信者の住所。ハンドルがあれば /@ハンドル、まだ無ければチャンネルの id */
export function channelPath(channel: { id: string; handle: string | null }): string {
  return channel.handle ? `/@${channel.handle}` : `/${channel.id}`;
}

/**
 * 住所の1段目が /@ハンドル なら、そのハンドルを返す。チャンネルの id なら null。
 * `@` は住所の中で %40 になって届くことがあるので、戻してから見る
 */
export function handleOfSegment(segment: string): string | null {
  const decoded = decodeURIComponent(segment);
  return decoded.startsWith('@') ? decoded.slice(1).toLowerCase() : null;
}
