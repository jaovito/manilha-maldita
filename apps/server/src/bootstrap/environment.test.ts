import { expect, test } from 'bun:test';
import { parseAccountSecurityEnvironment } from './environment';

const pepper = 'ab'.repeat(32);

test('account environment centralizes typed defaults and requires an explicit pepper', () => {
  expect(parseAccountSecurityEnvironment({ PASSWORD_PEPPER: pepper })).toEqual({
    argon2: { memoryKiB: 19_456, iterations: 2, maxMemoryKiB: 65_536, maxIterations: 6 },
    maxConcurrent: 2,
    memoryBudgetKiB: 131_072,
    pepper,
  });
  expect(() => parseAccountSecurityEnvironment({})).toThrow(
    /^INVALID_ACCOUNT_SECURITY_ENVIRONMENT$/,
  );
});

test('account cost overrides are bounded by the process memory budget and verification ceilings', () => {
  expect(
    parseAccountSecurityEnvironment({
      PASSWORD_PEPPER: pepper,
      ARGON2_MEMORY_KIB: '32768',
      ARGON2_ITERATIONS: '3',
      ARGON2_MAX_MEMORY_KIB: '65536',
      ARGON2_MAX_ITERATIONS: '8',
      PASSWORD_MAX_CONCURRENCY: '1',
      PASSWORD_MEMORY_BUDGET_KIB: '65536',
    }),
  ).toMatchObject({
    argon2: { memoryKiB: 32_768, iterations: 3, maxMemoryKiB: 65_536, maxIterations: 8 },
    maxConcurrent: 1,
    memoryBudgetKiB: 65_536,
  });

  for (const change of [
    { ARGON2_MEMORY_KIB: '19455' },
    { ARGON2_MAX_MEMORY_KIB: '262145' },
    { ARGON2_MEMORY_KIB: '65537' },
    { ARGON2_ITERATIONS: '1' },
    { ARGON2_MAX_ITERATIONS: '11' },
    { ARGON2_ITERATIONS: '7' },
    { PASSWORD_MAX_CONCURRENCY: '0' },
    { PASSWORD_MAX_CONCURRENCY: '9' },
    { PASSWORD_MEMORY_BUDGET_KIB: '19455' },
    { PASSWORD_MEMORY_BUDGET_KIB: '262145' },
    { PASSWORD_MAX_CONCURRENCY: '3' },
    { PASSWORD_PEPPER: '' },
    { PASSWORD_PEPPER: `${pepper}\n` },
  ])
    expect(() => parseAccountSecurityEnvironment({ PASSWORD_PEPPER: pepper, ...change })).toThrow(
      /^INVALID_ACCOUNT_SECURITY_ENVIRONMENT$/,
    );
});

test('numeric environment values fail closed without coercion or secret-bearing diagnostics', () => {
  for (const name of [
    'ARGON2_MEMORY_KIB',
    'ARGON2_ITERATIONS',
    'ARGON2_MAX_MEMORY_KIB',
    'ARGON2_MAX_ITERATIONS',
    'PASSWORD_MAX_CONCURRENCY',
    'PASSWORD_MEMORY_BUDGET_KIB',
  ]) {
    for (const value of [
      '',
      ' 2',
      '2 ',
      '2\n',
      '2.5',
      '2e1',
      '-2',
      'Infinity',
      'NaN',
      '999999999999999999999',
      '2; SELECT secret',
    ])
      expect(() =>
        parseAccountSecurityEnvironment({ PASSWORD_PEPPER: pepper, [name]: value }),
      ).toThrow(/^INVALID_ACCOUNT_SECURITY_ENVIRONMENT$/);
  }
});

test('authentication policy uses typed defaults and rejects unsafe or malformed overrides', async () => {
  const { parseAuthenticationPolicy } = await import('./environment');
  expect(parseAuthenticationPolicy({})).toEqual({
    sessionTtlMs: 86_400_000,
    attemptWindowMs: 300_000,
    loginAttempts: 5,
    ipAttempts: 20,
    globalAttempts: 200,
  });
  expect(parseAuthenticationPolicy({ AUTH_LOGIN_ATTEMPTS: '10' }).loginAttempts).toBe(10);
  for (const env of [
    { AUTH_LOGIN_ATTEMPTS: '5\n' },
    { AUTH_SESSION_TTL_MS: '1' },
    { AUTH_GLOBAL_ATTEMPTS: '1001' },
    { AUTH_IP_ATTEMPTS: 'NaN' },
    { AUTH_ATTEMPT_WINDOW_MS: '900001' },
  ])
    expect(() => parseAuthenticationPolicy(env)).toThrow('INVALID_AUTHENTICATION_POLICY');
});
