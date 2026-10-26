import { type RewardPolicy, validateRewardPolicy } from '../modules/progression';
import type { ServerEnvironment } from './environment';

export function parsePersistenceEnvironment(env: ServerEnvironment) {
  if (env.ENABLE_ACCOUNTS !== undefined && !['true', 'false'].includes(env.ENABLE_ACCOUNTS))
    throw new Error('INVALID_PERSISTENCE_ENVIRONMENT');
  if (env.ENABLE_ACCOUNTS !== 'true') return null;

  try {
    if (env.NODE_ENV !== undefined && !['development', 'test', 'production'].includes(env.NODE_ENV))
      throw new Error();

    const url = new URL(env.DATABASE_URL ?? '');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const production = (env.NODE_ENV ?? 'production') === 'production';

    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.username ||
      !url.password ||
      url.pathname.length < 2 ||
      url.hash
    )
      throw new Error();
    if ((!local || production) && url.searchParams.get('sslmode') !== 'verify-full')
      throw new Error();
    if ([...url.searchParams.keys()].some((key) => key !== 'sslmode')) throw new Error();
    if (
      production &&
      (env.SECURE_COOKIES !== 'true' ||
        !env.ALLOWED_ORIGINS ||
        env.ALLOWED_ORIGINS.split(',').some(
          (origin) => new URL(origin.trim()).protocol !== 'https:',
        ))
    )
      throw new Error();

    const number = (key: string, fallback: number, min: number, max: number) => {
      const text = env[key] ?? String(fallback);
      const value = Number(text);

      if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < min || value > max)
        throw new Error();

      return value;
    };
    const policy: RewardPolicy = {
      version: env.REWARD_POLICY_VERSION ?? 'm5-v2',
      soloXpPercent: number('REWARD_SOLO_XP_PERCENT', 50, 0, 99),
      completionXp: BigInt(number('REWARD_COMPLETION_XP', 100, 0, 1_000_000)),
      victoryXp: BigInt(number('REWARD_VICTORY_XP', 50, 0, 1_000_000)),
      competitiveVictoryPoints: BigInt(number('REWARD_COMPETITIVE_POINTS', 10, 0, 1_000_000)),
      xpPerLevel: BigInt(number('REWARD_XP_PER_LEVEL', 500, 1, 1_000_000)),
    };
    validateRewardPolicy(policy);

    return {
      url: url.toString(),
      tls: !local || production,
      policy,
      poolSize: number('DATABASE_POOL_SIZE', 4, 2, 8),
      leaseMs: number('AUTH_REVOCATION_LEASE_MS', 5000, 1000, 10_000),
      outboxCapacity: number('RESULT_OUTBOX_CAPACITY', 1024, 1, 4096),
      maintenanceMs: number('DATABASE_MAINTENANCE_MS', 60_000, 1000, 3_600_000),
      worker: {
        pollIntervalMs: number('JOB_POLL_INTERVAL_MS', 1000, 10, 60_000),
        maxJobsPerWake: number('JOB_MAX_JOBS_PER_WAKE', 25, 1, 100),
      },
    };
  } catch {
    throw new Error('INVALID_PERSISTENCE_ENVIRONMENT');
  }
}
