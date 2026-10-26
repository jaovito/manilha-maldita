import { expect, test } from 'bun:test';
import { parsePersistenceEnvironment } from './persistence-environment';

test('persistent startup is opt-in and validates TLS, origins and bounded typed defaults', () => {
  expect(parsePersistenceEnvironment({})).toBeNull();
  const env = {
    ENABLE_ACCOUNTS: 'true',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://local:fixture@127.0.0.1/truco_test',
  };
  expect(parsePersistenceEnvironment(env)).toMatchObject({
    tls: false,
    poolSize: 4,
    leaseMs: 5000,
    policy: {
      soloXpPercent: 50,
      completionXp: 100n,
      victoryXp: 50n,
      competitiveVictoryPoints: 10n,
      xpPerLevel: 500n,
    },
  });
  expect(
    parsePersistenceEnvironment({
      ...env,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://local:fixture@db.example/game?sslmode=verify-full',
      SECURE_COOKIES: 'true',
      ALLOWED_ORIGINS: 'https://game.example',
    }),
  ).toMatchObject({ tls: true });
  for (const patch of [
    { ENABLE_ACCOUNTS: 'yes' },
    { DATABASE_URL: 'bad' },
    { DATABASE_URL: 'https://db.example' },
    { DATABASE_URL: 'postgres://local:fixture@db.example/game' },
    { DATABASE_URL: `${env.DATABASE_URL}?host=evil` },
    { NODE_ENV: 'production' },
    { DATABASE_POOL_SIZE: '1' },
    { DATABASE_POOL_SIZE: '9' },
    { AUTH_REVOCATION_LEASE_MS: '0' },
    { RESULT_OUTBOX_CAPACITY: '0' },
    { REWARD_COMPLETION_XP: '-1' },
    { REWARD_SOLO_XP_PERCENT: '100' },
    { REWARD_POLICY_VERSION: 'bad\n' },
    { JOB_MAX_JOBS_PER_WAKE: '1e2' },
    { JOB_POLL_INTERVAL_MS: 'NaN' },
  ])
    expect(() => parsePersistenceEnvironment({ ...env, ...patch })).toThrow(
      'INVALID_PERSISTENCE_ENVIRONMENT',
    );
});
