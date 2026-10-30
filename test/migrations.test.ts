import { describe, expect, it } from 'vitest';
import { migrationNames, readMigrationNames } from '../scripts/lib/migrations';

describe('migrationNames', () => {
  it('決まった形のファイルだけを番号順に拾い、.sql を落とす', () => {
    expect(migrationNames(['0002_b.sql', 'README.md', '0001_a.sql', '1_bad.sql'])).toEqual([
      '0001_a',
      '0002_b',
    ]);
  });

  it('db/migrations/ のファイルはどれも決まった形になっている', async () => {
    const names = await readMigrationNames();
    expect(names[0]).toBe('0001_accounts');
  });
});
