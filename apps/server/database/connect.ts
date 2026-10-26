import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import {
  type DatabaseEnvironment,
  type DatabaseTarget,
  localDatabaseUrl,
  productionMigrationUrl,
} from './target';

export function connectLocalDatabase(target: DatabaseTarget, env?: DatabaseEnvironment) {
  const client = new SQL(localDatabaseUrl(target, env), { max: 1, connectionTimeout: 5 });
  return { db: drizzle({ client }), close: () => client.close() };
}
export type LocalDatabase = ReturnType<typeof connectLocalDatabase>['db'];
export type SeedTransaction = Parameters<Parameters<LocalDatabase['transaction']>[0]>[0];

export function connectMigrationDatabase(env: DatabaseEnvironment = process.env) {
  if (env.NODE_ENV !== 'production') return connectLocalDatabase('development', env);

  const client = new SQL(productionMigrationUrl(env), {
    max: 1,
    connectionTimeout: 5,
    tls: { rejectUnauthorized: true },
  });

  return { db: drizzle({ client }), close: () => client.close() };
}
