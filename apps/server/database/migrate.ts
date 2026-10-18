import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import type { LocalDatabase } from './connect';

export function migrateLocalDatabase(database: LocalDatabase) {
  return migrate(database, { migrationsFolder: resolve(import.meta.dir, 'migrations') });
}
