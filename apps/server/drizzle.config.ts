import { relative, resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';
import { localDatabaseUrl } from './database/target';

export default defineConfig({
  dialect: 'postgresql',
  schema: resolve(import.meta.dir, 'database/schema.ts'),
  out: relative(process.cwd(), resolve(import.meta.dir, 'database/migrations')),
  dbCredentials: { url: localDatabaseUrl('development') },
  strict: true,
  verbose: true,
});
