import { SQL } from 'bun';
import { Hono } from 'hono';
import { localDatabaseUrl } from '../../database/target';
import { createAccountApplication } from '../../src/modules/accounts';
import { registerAccountRoutes } from '../../src/modules/accounts/adapters/inbound/account-http';
import {
  createAccountSessionToken,
  hashAccountSessionToken,
} from '../../src/modules/accounts/adapters/outbound/crypto-session-token';
import { createPostgresAccountRepository } from '../../src/modules/accounts/adapters/outbound/postgres-account-repository';
import {
  createAuthRateKey,
  createPostgresAuthLimiter,
} from '../../src/modules/accounts/adapters/outbound/postgres-auth-limiter';
import {
  fixturePepper,
  passwordHasherFixture,
} from '../../src/modules/accounts/adapters/outbound/tests/password-hasher-fixture';
import { PasswordService } from '../../src/modules/accounts/application/services/password-service';
import { ensureDatabaseSchema } from './database-fixtures';

export async function withAuthenticationFixture(
  run: (fixture: {
    client: SQL;
    passwords: PasswordService;
    address: URL;
    login: string;
    password: string;
    key(value: string): string;
    repository: ReturnType<typeof createPostgresAccountRepository>;
    allow: ReturnType<typeof createPostgresAuthLimiter>;
    post(path: string, body: unknown, cookie?: string): Promise<Response>;
    get(cookie?: string): Promise<Response>;
  }) => Promise<void>,
) {
  await ensureDatabaseSchema();
  const client = new SQL(localDatabaseUrl('test'), { max: 6, connectionTimeout: 2 });
  const login = `a_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
  const password = "literal password ' OR 1=1; --";
  const passwords = new PasswordService(passwordHasherFixture(), 2);
  const repository = createPostgresAccountRepository(client);
  const allow = createPostgresAuthLimiter(client);
  const baseKey = createAuthRateKey(fixturePepper);
  const keys = new Set<string>();
  const key = (value: string) => {
    const hash = baseKey(`${login}:${value}`);
    keys.add(hash);
    return hash;
  };
  const application = createAccountApplication({
    repository,
    passwords,
    dummyPasswordHash: await passwords.hash('dummy account password fixture'),
    policy: {
      sessionTtlMs: 60_000,
      attemptWindowMs: 300_000,
      loginAttempts: 5,
      ipAttempts: 20,
      globalAttempts: 200,
    },
    allowAttempts: allow,
    rateKey: key,
    credentials: createAccountSessionToken,
    tokenHash: hashAccountSessionToken,
  });
  const app = new Hono();
  const origin = 'http://account-integration.test';
  registerAccountRoutes(app, application, [origin], false);
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: app.fetch });

  try {
    await run({
      client,
      passwords,
      address: server.url,
      login,
      password,
      key,
      repository,
      allow,
      post(path, body, cookie) {
        return fetch(new URL(`/api/accounts/${path}`, server.url), {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body: JSON.stringify(body),
        });
      },
      get(cookie) {
        return fetch(new URL('/api/accounts/session', server.url), {
          headers: cookie ? { Cookie: cookie } : {},
        });
      },
    });
  } finally {
    await server.stop(true);

    try {
      await client`DELETE FROM app.accounts WHERE login_name = ${login}`;
      for (const hash of keys)
        await client`DELETE FROM app.auth_rate_limits WHERE key_hash = ${hash}`;
    } finally {
      await client.close();
    }
  }
}
