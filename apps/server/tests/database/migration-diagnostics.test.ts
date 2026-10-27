import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import {
  DatabaseCommandError,
  databaseFailureCategory,
  databaseFailureMessage,
} from '../../database/diagnostics';
import { runDatabaseCommand } from '../../database/commands';

const secret = 'fixture-password-and-private-query';

test('migration diagnostics classify structured driver codes and nested Drizzle causes', () => {
  const cases = {
    SELF_SIGNED_CERT_IN_CHAIN: 'DATABASE_TLS_FAILED',
    ECONNREFUSED: 'DATABASE_CONNECTION_FAILED',
    '28P01': 'DATABASE_AUTHENTICATION_FAILED',
    '42501': 'DATABASE_PERMISSION_DENIED',
    '3D000': 'DATABASE_NOT_FOUND',
    '53300': 'DATABASE_CAPACITY_EXCEEDED',
    '55P03': 'DATABASE_OPERATION_TIMED_OUT',
    '42P07': 'MIGRATION_HISTORY_CONFLICT',
    '42703': 'MIGRATION_SQL_FAILED',
    ENOENT: 'MIGRATION_FILES_MISSING',
  } as const;

  for (const [code, category] of Object.entries(cases)) {
    const error = { message: secret, cause: { code, message: secret } };
    expect(databaseFailureCategory(error)).toBe(category);
    expect(databaseFailureCategory({ errno: code })).toBe(category);
    expect(databaseFailureMessage(error)).toContain(category);
    expect(databaseFailureMessage(error)).not.toContain(secret);
  }

  expect(databaseFailureCategory({ code: 'ERR_POSTGRES_SERVER_ERROR', errno: '42501' })).toBe(
    'DATABASE_PERMISSION_DENIED',
  );
});

test('configuration failures have actionable fixed hints without echoing environment values', () => {
  for (const message of [
    'INVALID_MIGRATION_ENVIRONMENT',
    'Invalid local database URL.',
    'Database tools require the designated local database and role for this target.',
    'Local database tools cannot run in production.',
    'Use migrate or seed, optionally followed by --test.',
  ]) {
    const text = databaseFailureMessage(new Error(message));
    expect(text).toContain('phase=configuration');
    expect(text).not.toContain('phase=unknown');
  }
});

test('unknown errors, secret-bearing properties, cycles and hostile getters cannot leak or recurse', () => {
  const cycle: { cause?: unknown } = {};
  cycle.cause = cycle;
  const hostile = Object.defineProperty({}, 'code', {
    get() {
      throw new Error(secret);
    },
  });

  for (const error of [
    null,
    undefined,
    secret,
    42,
    cycle,
    hostile,
    { code: secret, errno: secret, message: secret, category: '__proto__', phase: secret },
    { cause: { cause: { cause: { cause: { cause: { code: '42501' } } } } } },
  ]) {
    expect(databaseFailureCategory(error)).toBe('DATABASE_COMMAND_FAILED');
    const text = databaseFailureMessage(error);
    expect(text).toContain('DATABASE_COMMAND_FAILED');
    expect(text).not.toContain(secret);
    expect(text).not.toContain('__proto__');
  }
});

test('command errors retain only a safe category/phase and no raw driver cause', () => {
  const original = { code: '42501', message: secret, query: secret };
  const error = new DatabaseCommandError(original, 'migration');
  expect(error.message).toBe('DATABASE_COMMAND_FAILED');
  expect(error.cause).toBeUndefined();
  expect(databaseFailureMessage(error)).toContain('DATABASE_PERMISSION_DENIED; phase=migration');
  expect(JSON.stringify(error)).not.toContain(secret);
  expect(databaseFailureMessage({ category: 'DATABASE_TLS_FAILED', phase: secret })).not.toContain(
    secret,
  );
});

test('real local connection failure reports the connection phase and a sanitized category', async () => {
  await expect(
    runDatabaseCommand(['migrate', '--test'], {
      NODE_ENV: 'test',
      TEST_DATABASE_URL: 'postgres://truco_test:fixture@127.0.0.1:1/truco_test',
    }),
  ).rejects.toMatchObject({
    message: 'DATABASE_COMMAND_FAILED',
    category: 'DATABASE_CONNECTION_FAILED',
    phase: 'connection',
  });
});

test('CLI exits nonzero with safe production-configuration diagnostics and no connection string', async () => {
  const child = Bun.spawn(
    [process.execPath, resolve(import.meta.dir, '../../database/cli.ts'), 'migrate'],
    {
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: `postgres://migration:${secret}@db.example/game`,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  expect(code).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('INVALID_MIGRATION_ENVIRONMENT; phase=configuration');
  expect(stderr).toContain('sslmode=verify-full');
  expect(stderr).not.toContain(secret);
  expect(stderr).not.toContain('db.example');
  expect(stderr).not.toContain('postgres://');
});
