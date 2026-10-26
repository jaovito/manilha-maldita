import { expect } from 'bun:test';
import { connectLocalDatabase, type SeedTransaction } from '../../database/connect';
import { migrateLocalDatabase } from '../../database/migrate';

let migration: Promise<void> | undefined;

export function ensureDatabaseSchema() {
  migration ??= (async () => {
    const connection = connectLocalDatabase('test');

    try {
      await migrateLocalDatabase(connection.db);
    } finally {
      await connection.close();
    }
  })();

  return migration;
}

export async function withDatabaseFixture(run: (tx: SeedTransaction) => Promise<void>) {
  await ensureDatabaseSchema();
  const connection = connectLocalDatabase('test');
  const rollback = new Error('fixture rollback');

  try {
    await connection.db.transaction(async (tx) => {
      await run(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await connection.close();
  }
}

export async function rejectsConstraint(
  tx: SeedTransaction,
  name: string,
  run: (savepoint: SeedTransaction) => Promise<unknown>,
) {
  await expect(tx.transaction(run)).rejects.toMatchObject({ cause: { constraint: name } });
}
