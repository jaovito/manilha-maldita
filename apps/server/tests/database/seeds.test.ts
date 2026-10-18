import { expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { connectLocalDatabase } from '../../database/connect';
import { migrateLocalDatabase } from '../../database/migrate';
import journal from '../../database/migrations/meta/_journal.json';
import { runSeeds, type SeedTask } from '../../database/seeds/run';

// The only populated model here is a disposable integration-test fixture.
test('real PostgreSQL migrations and deterministic seeds are repeatable and transactional', async () => {
  const connection = connectLocalDatabase('test');
  const { db } = connection;
  const schemaName = `fixture_${crypto.randomUUID().replaceAll('-', '')}`;
  const schema = sql.identifier(schemaName);
  const records = sql.identifier(`${schemaName}`);
  try {
    const identity = await db.execute<{ name: string }>(sql`SELECT current_database() AS name`);
    expect(identity[0]?.name).toBe('truco_test');
    await migrateLocalDatabase(db);
    await migrateLocalDatabase(db);
    const migrations = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`,
    );
    expect(migrations[0]?.count).toBe(journal.entries.length);
    await db.execute(sql`CREATE SCHEMA ${schema}`);
    await db.execute(
      sql`CREATE TABLE ${records}.seed_records (id text PRIMARY KEY, label text NOT NULL)`,
    );
    const fixtures: SeedTask[] = [
      {
        id: 'fixture-records',
        async run(transaction) {
          await transaction.execute(sql`
          INSERT INTO ${records}.seed_records (id, label)
          VALUES ('guest-a', 'Convidado A'), ('guest-b', 'Convidado B')
          ON CONFLICT (id) DO UPDATE SET label = excluded.label
        `);
        },
      },
    ];
    expect(await runSeeds(db, fixtures)).toEqual(['fixture-records']);
    await db.execute(sql`UPDATE ${records}.seed_records SET label = 'outdated'`);
    await runSeeds(db, fixtures);
    const rows = await db.execute<{ id: string; label: string }>(
      sql`SELECT id, label FROM ${records}.seed_records ORDER BY id`,
    );
    expect(Array.from(rows)).toEqual([
      { id: 'guest-a', label: 'Convidado A' },
      { id: 'guest-b', label: 'Convidado B' },
    ]);
    const failure: SeedTask[] = [
      {
        id: 'insert',
        run: async (transaction) => {
          await transaction.execute(
            sql`INSERT INTO ${records}.seed_records VALUES ('rollback', 'rollback')`,
          );
        },
      },
      {
        id: 'fail',
        run: async () => {
          throw new Error('intentional fixture failure');
        },
      },
    ];
    await expect(runSeeds(db, failure)).rejects.toThrow('intentional fixture failure');
    const afterFailure = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM ${records}.seed_records`,
    );
    expect(afterFailure[0]?.count).toBe(2);
    await expect(
      runSeeds(
        db,
        [fixtures[0], fixtures[0]].filter((task): task is SeedTask => !!task),
      ),
    ).rejects.toThrow('unique');
    await expect(runSeeds(db, [{ id: ' ', run: async () => {} }])).rejects.toThrow('nonempty');
    expect(await runSeeds(db, [])).toEqual([]);
  } finally {
    try {
      await db.execute(sql`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await connection.close();
    }
  }
}, 15_000);
