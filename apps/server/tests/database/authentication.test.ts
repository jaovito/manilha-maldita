import type { SQL } from 'bun';
import { expect, test } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { authRateLimits } from '../../database/schema';
import {
  createPostgresAuthLimiter,
  createAuthRateKey,
} from '../../src/modules/accounts/adapters/outbound/postgres-auth-limiter';
import { withAuthenticationFixture } from './authentication-fixture';

function cookie(response: Response) {
  const value = response.headers.get('Set-Cookie')?.split(';')[0];
  if (!value) throw new Error('Expected an account cookie');
  return value;
}

test('real HTTP/PostgreSQL registration, login rotation and logout persist only verifiers', async () => {
  await withAuthenticationFixture(async (fixture) => {
    const { login, password, client, post, get } = fixture;
    const registration = await post('register', { login, password, nickname: 'Player' });
    expect(registration.status).toBe(201);
    expect(await registration.json()).toEqual({ nickname: 'Player' });
    const first = cookie(registration);
    expect((await get(first)).status).toBe(200);
    expect((await post('register', { login, password, nickname: 'Player' })).status).toBe(400);

    const authenticated = await post('login', { login, password }, first);
    expect(authenticated.status).toBe(200);
    const second = cookie(authenticated);
    expect(second).not.toBe(first);
    expect((await get(first)).status).toBe(401);
    expect((await get(second)).status).toBe(200);
    const rows = await client<
      { token_hash: string; password_hash: string; xp: string; competitive_points: string }[]
    >`SELECT s.token_hash, a.password_hash, p.xp, p.competitive_points FROM app.accounts a
      JOIN app.sessions s ON s.account_id = a.id JOIN app.player_progress p ON p.account_id = a.id WHERE a.login_name = ${login}`;
    expect(rows.length).toBe(2);
    expect(JSON.stringify(rows)).not.toContain(password);
    expect(JSON.stringify(rows)).not.toContain(second.split('=')[1]);
    expect(rows.every((row) => row.xp === '0' && row.competitive_points === '0')).toBe(true);

    expect((await post('logout', {}, second)).status).toBe(204);
    expect((await get(second)).status).toBe(401);
    expect((await post('logout', {}, second)).status).toBe(204);
    expect((await get("truco_account=' OR 1=1--")).status).toBe(401);
    expect((await get()).status).toBe(401);
  });
});

test('unknown users, wrong passwords and disabled accounts share failures; expiry and disabling invalidate sessions', async () => {
  await withAuthenticationFixture(async ({ login, password, client, post, get }) => {
    const unknown = await post('login', { login, password });
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toEqual({ code: 'INVALID_CREDENTIALS' });
    const registration = await post('register', { login, password, nickname: 'Player' });
    const active = cookie(registration);
    const wrong = await post('login', { login, password: 'wrong password fixture' });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ code: 'INVALID_CREDENTIALS' });
    await client`UPDATE app.accounts SET status = 'disabled' WHERE login_name = ${login}`;
    const disabled = await post('login', { login, password });
    expect(disabled.status).toBe(401);
    expect(await disabled.json()).toEqual({ code: 'INVALID_CREDENTIALS' });
    expect((await get(active)).status).toBe(401);
    const [row] = await client`SELECT id FROM app.accounts WHERE login_name = ${login}`;
    expect(await fixtureIssueDisabled(client, row.id)).toBe(false);
    await client`UPDATE app.accounts SET status = 'active' WHERE login_name = ${login}`;
    await client`UPDATE app.sessions SET created_at = clock_timestamp() - interval '2 hours', expires_at = clock_timestamp() - interval '1 hour'
      WHERE account_id = ${row.id}`;
    expect((await get(active)).status).toBe(401);
  });
});

async function fixtureIssueDisabled(client: SQL, id: string) {
  const { createPostgresAccountRepository } = await import(
    '../../src/modules/accounts/adapters/outbound/postgres-account-repository'
  );

  return createPostgresAccountRepository(client).issueSession(id, 'a'.repeat(64), 60_000, null);
}

test('real HTTP injection attempts and forged rewards are rejected without changing account/progress rows', async () => {
  await withAuthenticationFixture(async ({ login, password, client, post }) => {
    for (const input of [
      { login: "' OR 1=1--", password, nickname: 'Player' },
      { login, password, nickname: 'Player', xp: 99999 },
      { login, password, nickname: 'Player', accountId: crypto.randomUUID() },
      { login, password: {}, nickname: 'Player' },
    ])
      expect((await post('register', input)).status).toBe(400);
    expect((await client`SELECT id FROM app.accounts WHERE login_name = ${login}`).length).toBe(0);
    expect((await post('register', { login, password, nickname: 'Player' })).status).toBe(201);
    const [row] =
      await client`SELECT p.xp, p.competitive_points FROM app.player_progress p JOIN app.accounts a ON a.id = p.account_id WHERE a.login_name = ${login}`;
    expect(row.xp).toBe('0');
    expect(row.competitive_points).toBe('0');
  });
});

test('PostgreSQL throttling survives adapter recreation, serializes concurrent attempts and resets expired windows', async () => {
  expect(getTableConfig(authRateLimits).indexes.map((index) => index.config.name)).toContain(
    'auth_rate_limits_expiry_idx',
  );
  expect(() => createAuthRateKey('short')).toThrow('INVALID_PASSWORD_PEPPER');

  await withAuthenticationFixture(async ({ client, key, allow }) => {
    const rule = { key: key('concurrency'), maximum: 3, windowMs: 300_000 };
    const results = await Promise.all(Array.from({ length: 12 }, () => allow([rule])));
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await createPostgresAuthLimiter(client)([rule])).toBe(false);
    await client`UPDATE app.auth_rate_limits SET expires_at = clock_timestamp() - interval '1 second' WHERE key_hash = ${rule.key}`;
    expect(await allow([rule])).toBe(true);
  });
});

test('HTTP authentication limits apply before password work across correct and incorrect attempts', async () => {
  await withAuthenticationFixture(async ({ login, password, post }) => {
    expect((await post('register', { login, password, nickname: 'Player' })).status).toBe(201);
    for (let attempt = 0; attempt < 4; attempt++)
      expect((await post('login', { login, password: 'wrong password fixture' })).status).toBe(401);
    const blocked = await post('login', { login, password });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ code: 'AUTH_RATE_LIMITED' });
  });
});

test('registration rolls back partial records and concurrent duplicates create one account/session', async () => {
  await withAuthenticationFixture(async ({ client, login, password, repository, post }) => {
    const { fixturePasswordHash } = await import('./account-fixtures');
    await expect(
      repository.register(login, fixturePasswordHash, '', 'a'.repeat(64), 60_000),
    ).rejects.toThrow();
    expect((await client`SELECT id FROM app.accounts WHERE login_name = ${login}`).length).toBe(0);

    const attempts = await Promise.all([
      post('register', { login, password, nickname: 'Player' }),
      post('register', { login, password, nickname: 'Player' }),
    ]);
    expect(attempts.map((response) => response.status).sort()).toEqual([201, 400]);
    const [counts] =
      await client`SELECT (SELECT count(*) FROM app.profiles WHERE account_id = a.id) AS profiles,
      (SELECT count(*) FROM app.player_progress WHERE account_id = a.id) AS progress,
      (SELECT count(*) FROM app.sessions WHERE account_id = a.id) AS sessions
      FROM app.accounts a WHERE a.login_name = ${login}`;
    expect(counts).toMatchObject({ profiles: '1', progress: '1', sessions: '1' });
  });
});

test('an expired rate key resets even when bounded cleanup cannot remove it in the current batch', async () => {
  await withAuthenticationFixture(async ({ client, key, allow }) => {
    for (let index = 0; index < 100; index++)
      await client`INSERT INTO app.auth_rate_limits (key_hash, attempts, expires_at)
        VALUES (${key(`old:${index}`)}, 1, clock_timestamp() - interval '2 hours')`;
    const target = key('expired-target');
    await client`INSERT INTO app.auth_rate_limits (key_hash, attempts, expires_at)
      VALUES (${target}, 5, clock_timestamp() - interval '1 hour')`;
    expect(await allow([{ key: target, maximum: 5, windowMs: 300_000 }])).toBe(true);
    const [row] =
      await client`SELECT attempts, expires_at > statement_timestamp() AS fresh FROM app.auth_rate_limits WHERE key_hash = ${target}`;
    expect(row).toMatchObject({ attempts: 1, fresh: true });
  });
});
