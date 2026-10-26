import { SQL } from 'bun';
import { createAccountApplication } from '../modules/accounts';
import {
  createAccountSessionToken,
  hashAccountSessionToken,
} from '../modules/accounts/adapters/outbound/crypto-session-token';
import { createPostgresAccountMaintenance } from '../modules/accounts/adapters/outbound/postgres-account-maintenance';
import { createPostgresAccountRepository } from '../modules/accounts/adapters/outbound/postgres-account-repository';
import {
  createAuthRateKey,
  createPostgresAuthLimiter,
} from '../modules/accounts/adapters/outbound/postgres-auth-limiter';
import {
  createRecoveryCode,
  hashRecoveryCode,
} from '../modules/accounts/adapters/outbound/recovery-credentials';
import { createAccountMaintenance } from '../modules/accounts/application/account-maintenance';
import { startJobWorker, type WorkerEvent } from '../modules/jobs';
import { PostgresJobQueue } from '../modules/jobs/adapters/outbound/postgres-queue';
import { createPlayerApplication } from '../modules/progression';
import { createPostgresPlayers } from '../modules/progression/adapters/outbound/postgres-players';
import { createPostgresResultWriter } from '../modules/progression/adapters/outbound/postgres-results';
import {
  ensureRewardPolicy,
  grantMatchRewards,
} from '../modules/progression/adapters/outbound/postgres-rewards';
import { createResultOutbox } from '../modules/progression/adapters/outbound/result-outbox';
import { createAccountSecurity } from './account-security';
import { loadPasswordBlocklist } from './password-blocklist';
import { startDatabaseMaintenance } from './database-maintenance';
import {
  parseAccountSecurityEnvironment,
  parseAuthenticationPolicy,
  type ServerEnvironment,
} from './environment';
import { parsePersistenceEnvironment } from './persistence-environment';

export async function createPersistentBackend(
  env: ServerEnvironment,
  observe?: (event: WorkerEvent) => void,
) {
  const config = parsePersistenceEnvironment(env);

  if (!config) return null;

  const client = new SQL(config.url, {
    max: config.poolSize,
    connectionTimeout: 5,
    idleTimeout: 30,
    ...(config.tls ? { tls: { rejectUnauthorized: true } } : {}),
  });

  try {
    // Schema migrations and product seeds are explicit operational steps, never startup side effects.
    const defaults =
      await client`SELECT id FROM app.avatars WHERE id = 'avatar-1' AND active = true`;

    if (!defaults.length) throw new Error('CATALOG_NOT_INITIALIZED');

    await ensureRewardPolicy(client, config.policy);
    const passwords = createAccountSecurity(env, await loadPasswordBlocklist(env));
    const policy = parseAuthenticationPolicy(env);
    const security = parseAccountSecurityEnvironment(env);
    const repository = createPostgresAccountRepository(client);
    const maintenanceRepository = createPostgresAccountMaintenance(client);
    const shared = {
      passwords,
      policy,
      dummyPasswordHash: await passwords.hash(crypto.randomUUID() + crypto.randomUUID()),
      allowAttempts: createPostgresAuthLimiter(client),
      rateKey: createAuthRateKey(security.pepper),
      audit: maintenanceRepository.audit,
    };
    const accounts = createAccountApplication({
      ...shared,
      repository,
      credentials: createAccountSessionToken,
      tokenHash: hashAccountSessionToken,
    });
    const maintenance = createAccountMaintenance({
      ...shared,
      accounts,
      repository: maintenanceRepository,
      recovery: createRecoveryCode,
      recoveryHash: hashRecoveryCode,
    });
    const players = createPlayerApplication(
      createPostgresPlayers(client, config.policy.xpPerLevel),
    );
    let queueHealthy = true;
    let resultHealthy = true;
    let maintenanceHealthy = true;
    const outbox = createResultOutbox(
      config.policy.version,
      createPostgresResultWriter(client),
      {
        schedule(delay, callback) {
          const timer = setTimeout(callback, delay);
          return () => clearTimeout(timer);
        },
        report(code) {
          resultHealthy = code === 'result_persisted';
        },
      },
      config.outboxCapacity,
    );
    const queue = new PostgresJobQueue(client, grantMatchRewards);
    const worker = await startJobWorker(
      {
        subscribe: (wake) => queue.subscribe(wake),
        async runNext() {
          try {
            const outcome = await queue.runNext();
            queueHealthy = true;
            return outcome;
          } catch {
            queueHealthy = false;
            throw new Error('QUEUE_UNAVAILABLE');
          }
        },
      },
      {
        schedule(delay, callback) {
          const timer = setTimeout(callback, delay);
          return () => clearTimeout(timer);
        },
        report(event) {
          observe?.(event);
          /* Operational state is exposed through readiness without job payloads. */
        },
      },
      config.worker,
    );
    const stopMaintenance = startDatabaseMaintenance(client, config.maintenanceMs, (healthy) => {
      maintenanceHealthy = healthy;
    });
    let stopping: Promise<void> | null = null;

    return {
      accounts,
      players,
      maintenance,
      results: outbox.writer,
      leaseMs: config.leaseMs,
      ready: () => queueHealthy && resultHealthy && maintenanceHealthy,
      close() {
        stopping ??= (async () => {
          try {
            await outbox.close();
          } finally {
            try {
              await worker.stop();
            } finally {
              try {
                await stopMaintenance();
              } finally {
                await client.close();
              }
            }
          }
        })();

        return stopping;
      },
    };
  } catch {
    await client.close();
    throw new Error('PERSISTENT_BACKEND_START_FAILED');
  }
}

export type PersistentBackend = NonNullable<Awaited<ReturnType<typeof createPersistentBackend>>>;
