import { expect, test } from 'bun:test';
import { localDatabaseUrl } from '../../database/target';

test('development and test targets have distinct local defaults', () => {
  expect(localDatabaseUrl('development', {})).toContain('127.0.0.1:55432/truco_dev');
  expect(localDatabaseUrl('test', {})).toContain('127.0.0.1:55433/truco_test');
  expect(localDatabaseUrl('test', { DATABASE_URL: 'https://must-not-be-used.example' })).toContain(
    '/truco_test',
  );
  expect(
    localDatabaseUrl('test', {
      TEST_DATABASE_URL: 'postgres://truco_test:local@localhost:6543/truco_test',
    }),
  ).toContain('localhost:6543');
});

for (const url of [
  'https://truco_test:local@localhost/truco_test',
  'postgres://truco_test:local@remote.example/truco_test',
  'postgres://truco_test:local@127.0.0.1/truco_dev',
  'postgres://truco:local@127.0.0.1/truco_test',
  'postgres://truco_test:local@127.0.0.1/truco_test?host=remote.example',
  'postgres://truco_test:local@127.0.0.1/truco_test#unexpected',
  'not-a-url',
]) {
  test(`local tooling rejects an invalid database target: ${new URL(url, 'https://invalid').hostname}`, () => {
    expect(() => localDatabaseUrl('test', { TEST_DATABASE_URL: url })).toThrow();
  });
}

test('local database tools reject production mode', () => {
  expect(() => localDatabaseUrl('test', { NODE_ENV: 'production' })).toThrow(
    'cannot run in production',
  );
});
