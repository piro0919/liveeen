/** 検索の言葉の長さの上限。名前もタイトルもハンドルも、これより長いものは無くてよい */
const QUERY_MAX = 100;

/** 入れられた言葉を整える。NUL（Postgres の text に入らない）と前後の空白を落とし、長すぎる分は切る。何も無ければ null */
export function normalizeSearchQuery(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const query = input.replaceAll('\0', '').trim().slice(0, QUERY_MAX);
  return query === '' ? null : query;
}

/** 言葉を含むものを探す like の形にする。% と _ は入れられたとおりの文字として探す */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (mark) => `\\${mark}`)}%`;
}
