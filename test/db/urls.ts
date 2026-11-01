/**
 * DB を読み書きするテスト（test/db/）の接続先。手元の Postgres（compose.yaml）か CI の Postgres の中に、
 * テスト専用の DB を作って使う（jumps-lab と同じ作り）。手元の DB（liveeen）の行には触れない。
 *
 * DATABASE_URL のホストが手元でなければ止まる。端末に本番（Neon）の接続文字列が入っていても、
 * テストが本番の DB を消したり作ったりしないように
 */
const base = process.env.DATABASE_URL || 'postgres://liveeen:liveeen@localhost:5435/liveeen';

/** テスト用の DB の名前。作り直すときに消すので、この名前の DB にしか使わない */
export const TEST_DB = 'liveeen_test';

/** つないでよいホスト。手元の Postgres と、CI のサービス（GitHub Actions はポートを localhost に出す） */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname);
}

const url = new URL(base);
if (!isLocalHost(url.hostname)) {
  throw new Error(
    `DB のテストは手元の Postgres にしかつなぎません（DATABASE_URL のホストが ${url.hostname}）`,
  );
}

/** テスト用の DB を作り直すときにつなぐ先（同じサーバーの、手元の DB） */
export const adminUrl = url.href;

const test = new URL(url);
test.pathname = `/${TEST_DB}`;
export const testUrl = test.href;
