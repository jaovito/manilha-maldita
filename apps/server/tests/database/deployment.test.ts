import { expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { runDatabaseCommand } from '../../database/commands';
import { connectMigrationDatabase } from '../../database/connect';
import { productionMigrationUrl } from '../../database/target';
import {
  avatarDefinitions,
  deckDefinitions,
  tableDefinitions,
} from '../../src/modules/progression';
import { withDatabaseFixture } from './database-fixtures';

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://deploy:fixture@db.example/game?sslmode=verify-full',
};

test('deployment migrations require explicit credentials and certificate-verified TLS', async () => {
  expect(productionMigrationUrl(production)).toBe(production.DATABASE_URL);

  for (const patch of [
    { NODE_ENV: 'development' },
    { DATABASE_URL: undefined },
    { DATABASE_URL: 'not-a-url' },
    { DATABASE_URL: 'https://deploy:fixture@db.example/game?sslmode=verify-full' },
    { DATABASE_URL: 'postgres://db.example/game?sslmode=verify-full' },
    { DATABASE_URL: 'postgres://deploy:fixture@db.example/?sslmode=verify-full' },
    { DATABASE_URL: 'postgres://deploy:fixture@db.example/game' },
    { DATABASE_URL: 'postgres://deploy:fixture@db.example/game?sslmode=require' },
    { DATABASE_URL: `${production.DATABASE_URL}&sslmode=disable` },
    { DATABASE_URL: `${production.DATABASE_URL}&host=attacker.example` },
    { DATABASE_URL: `${production.DATABASE_URL}#fragment` },
  ]) {
    expect(() => productionMigrationUrl({ ...production, ...patch })).toThrow(
      'INVALID_MIGRATION_ENVIRONMENT',
    );
  }

  // SQL connections are lazy: construction/close must not contact this example host.
  const connection = connectMigrationDatabase(production);
  await connection.close();
  const local = connectMigrationDatabase({ NODE_ENV: 'test' });
  await local.close();
});

test('deployment CLI rejects unsupported arguments and never enables production seeds/test targets', async () => {
  for (const args of [[], ['reset'], ['migrate', '--force'], ['migrate', '--test', '--extra']])
    await expect(runDatabaseCommand(args, {})).rejects.toThrow('Use migrate or seed');

  for (const args of [['seed'], ['seed', '--test'], ['migrate', '--test']])
    await expect(runDatabaseCommand(args, production)).rejects.toThrow('cannot run in production');

  await expect(runDatabaseCommand(['migrate'], { NODE_ENV: 'production' })).rejects.toThrow(
    'INVALID_MIGRATION_ENVIRONMENT',
  );
  await expect(
    runDatabaseCommand(['migrate', '--test'], {
      NODE_ENV: 'test',
      TEST_DATABASE_URL: 'postgres://truco_test:fixture@127.0.0.1:1/truco_test',
    }),
  ).rejects.toThrow('DATABASE_COMMAND_FAILED');
});

test('real migration command and local seeds are repeatable against the guarded test database', async () => {
  expect(
    await Promise.all([
      runDatabaseCommand(['migrate', '--test']),
      runDatabaseCommand(['migrate', '--test']),
    ]),
  ).toEqual(['Database migrations applied.', 'Database migrations applied.']);
  expect(await runDatabaseCommand(['seed', '--test'])).toBe('Local product seeds applied.');
});

test('catalog data migration initializes empty catalogs and preserves existing curated items', () =>
  withDatabaseFixture(async (tx) => {
    // This fixture is rolled back; no developer or production catalogs are modified.
    await tx.execute(sql`DELETE FROM app.avatars`);
    await tx.execute(sql`DELETE FROM app.deck_themes`);
    await tx.execute(sql`DELETE FROM app.table_themes`);
    const migration = await Bun.file(
      new URL('../../database/migrations/0007_initial-cosmetic-catalog.sql', import.meta.url),
    ).text();
    const apply = async () => {
      // Trusted, checked-in SQL only; never runtime values or browser input.
      for (const statement of migration.split('--> statement-breakpoint'))
        await tx.execute(sql.raw(statement));
    };

    await apply();
    const avatars = await tx.execute(sql`SELECT id, name, avatar_url AS "avatarUrl",
      sprite_index AS "spriteIndex", required_level AS "requiredLevel"
      FROM app.avatars ORDER BY sort_order`);
    expect(Array.from(avatars)).toEqual([...avatarDefinitions.slice(0, 4)]);

    for (const [query, definitions] of [
      [
        sql`SELECT id, name, asset_key AS "assetKey", required_level AS "requiredLevel"
        FROM app.deck_themes ORDER BY sort_order`,
        deckDefinitions,
      ],
      [
        sql`SELECT id, name, asset_key AS "assetKey", required_level AS "requiredLevel"
        FROM app.table_themes ORDER BY sort_order`,
        tableDefinitions,
      ],
    ] as const) {
      const rows = await tx.execute(query);
      expect(Array.from(rows)).toEqual(definitions.map(({ style: _style, ...item }) => item));
    }

    await tx.execute(
      sql`UPDATE app.avatars SET name = 'Curated', active = false WHERE id = 'avatar-1'`,
    );
    await tx.execute(sql`UPDATE app.deck_themes SET required_level = 9 WHERE id = 'arcane'`);
    await tx.execute(sql`UPDATE app.table_themes SET required_level = 9 WHERE id = 'midnight'`);
    await apply();
    expect(
      Array.from(await tx.execute(sql`SELECT name, active FROM app.avatars WHERE id = 'avatar-1'`)),
    ).toEqual([{ name: 'Curated', active: false }]);
    expect(
      (await tx.execute(sql`SELECT required_level FROM app.deck_themes WHERE id = 'arcane'`))[0]
        ?.required_level,
    ).toBe(9);
    expect(
      (await tx.execute(sql`SELECT required_level FROM app.table_themes WHERE id = 'midnight'`))[0]
        ?.required_level,
    ).toBe(9);
    expect((await tx.execute(sql`SELECT count(*)::int AS count FROM app.avatars`))[0]?.count).toBe(
      4,
    );
    expect(
      (await tx.execute(sql`SELECT count(*)::int AS count FROM app.deck_themes`))[0]?.count,
    ).toBe(3);
    expect(
      (await tx.execute(sql`SELECT count(*)::int AS count FROM app.table_themes`))[0]?.count,
    ).toBe(3);
  }));

test('additional avatar data migration preserves curated rows and all existing selections', () =>
  withDatabaseFixture(async (tx) => {
    await tx.execute(
      sql`DELETE FROM app.avatars WHERE id IN ('avatar-5','avatar-6','avatar-7','avatar-8')`,
    );
    const migration = await Bun.file(
      new URL('../../database/migrations/0009_additional-pixel-avatars.sql', import.meta.url),
    ).text();
    const insert = migration
      .split('--> statement-breakpoint')
      .find((statement) => statement.includes('INSERT INTO app.avatars'));
    if (!insert) throw new Error('Missing avatar catalog migration');
    await tx.execute(sql.raw(insert));
    const rows = await tx.execute(
      sql`SELECT id,name,avatar_url AS "avatarUrl",sprite_index AS "spriteIndex",required_level AS "requiredLevel" FROM app.avatars WHERE sprite_index >= 4 ORDER BY sort_order`,
    );
    expect(Array.from(rows)).toEqual([...avatarDefinitions.slice(4)]);
    await tx.execute(
      sql`UPDATE app.avatars SET name='Curated new avatar',active=false,required_level=12 WHERE id='avatar-5'`,
    );
    await tx.execute(sql.raw(insert));
    expect(
      (
        await tx.execute(
          sql`SELECT name,active,required_level FROM app.avatars WHERE id='avatar-5'`,
        )
      )[0],
    ).toEqual({ name: 'Curated new avatar', active: false, required_level: 12 });
  }));
