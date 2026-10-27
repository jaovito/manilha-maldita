import { sql } from 'drizzle-orm';
import { connectLocalDatabase, connectMigrationDatabase } from './connect';
import { DatabaseCommandError, type DatabasePhase } from './diagnostics';
import { migrateLocalDatabase } from './migrate';
import { developmentSeeds } from './seeds/registry';
import { runSeeds } from './seeds/run';
import type { DatabaseEnvironment } from './target';

export async function runDatabaseCommand(
  args: readonly string[],
  env: DatabaseEnvironment = process.env,
) {
  const [action, flag] = args;

  if (
    !['migrate', 'seed'].includes(action ?? '') ||
    args.length > 2 ||
    (flag !== undefined && flag !== '--test')
  )
    throw new Error('Use migrate or seed, optionally followed by --test.');

  // Seeds and test targets retain all existing local-only guards.
  const connection =
    action === 'migrate' && flag !== '--test'
      ? connectMigrationDatabase(env)
      : connectLocalDatabase(flag === '--test' ? 'test' : 'development', env);

  let phase: DatabasePhase = action === 'migrate' ? 'connection' : 'seed';

  try {
    if (action === 'migrate') {
      // One connection retains the session lock across Drizzle's migration transaction.
      // Concurrent pre-deploy jobs wait, then re-read the committed migration history.
      await connection.db.execute(sql`SET lock_timeout = '30s'`);
      await connection.db.execute(sql`SET statement_timeout = '120s'`);

      phase = 'lock';
      await connection.db.execute(sql`SELECT pg_advisory_lock(18452, 1)`);

      phase = 'migration';
      await migrateLocalDatabase(connection.db);

      return 'Database migrations applied.';
    }

    await runSeeds(connection.db, developmentSeeds);

    return 'Local product seeds applied.';
  } catch (error) {
    // Preserve only a fixed category and phase, never the original driver error or cause.
    throw new DatabaseCommandError(error, phase);
  } finally {
    // Closing the single-connection pool also releases the advisory lock after failures.
    await connection.close();
  }
}
