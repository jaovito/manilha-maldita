import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { type DatabaseEnvironment, type DatabaseTarget, localDatabaseUrl } from './target';

export function connectLocalDatabase(target: DatabaseTarget, env?: DatabaseEnvironment) {
  const client = new SQL(localDatabaseUrl(target, env), { max: 1, connectionTimeout: 5 });
  return { db: drizzle({ client }), close: () => client.close() };
}
export type LocalDatabase = ReturnType<typeof connectLocalDatabase>['db'];
export type SeedTransaction = Parameters<Parameters<LocalDatabase['transaction']>[0]>[0];
