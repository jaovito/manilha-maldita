import { connectLocalDatabase } from '../../apps/server/database/connect';
import { migrateLocalDatabase } from '../../apps/server/database/migrate';
import { cosmeticCatalogSeed } from '../../apps/server/database/seeds/catalogs';
import { runSeeds } from '../../apps/server/database/seeds/run';
import { localDatabaseUrl } from '../../apps/server/database/target';
import { main, shutdown } from '../../apps/server/src/bootstrap/main';

// This bootstrap refuses remote/development databases and uses only a public test pepper.
const databaseUrl = localDatabaseUrl('test');
const connection = connectLocalDatabase('test');
try {
  await migrateLocalDatabase(connection.db);
  await runSeeds(connection.db, [cosmeticCatalogSeed]);
} finally {
  await connection.close();
}

const runtime = await main({
  NODE_ENV: 'test',
  PORT: '3001',
  ENABLE_ACCOUNTS: 'true',
  ENABLE_SOLO: 'true',
  DATABASE_URL: databaseUrl,
  PASSWORD_PEPPER: 'ab'.repeat(32),
  JOB_POLL_INTERVAL_MS: '10',
  AUTH_LOGIN_ATTEMPTS: '100',
  AUTH_IP_ATTEMPTS: '1000',
});
process.once('SIGINT', shutdown.bind(null, runtime));
process.once('SIGTERM', shutdown.bind(null, runtime));
