import { recoveryResponseSchema } from '@truco/game-protocol';
import { expect, test } from 'bun:test';
import { SQL } from 'bun';
import { localDatabaseUrl } from '../../database/target';
import { createPersistentBackend } from '../../src/bootstrap/persistent-backend';
import { startServer } from '../../src/bootstrap/runtime';
import { ensurePersistentCatalogs, persistentEnvironment } from './persistent-fixture';

for (const trusted of [false, true]) {
  test(`HTTP audit stores bounded request context with trusted proxy=${trusted} and erases account context on deletion`, async () => {
    await ensurePersistentCatalogs();
    const backend = await createPersistentBackend(persistentEnvironment());
    if (!backend) throw new Error('Missing persistent backend');
    const origin = 'http://audit.test';
    const runtime = startServer({
      backend,
      port: 0,
      environment: 'test',
      allowedOrigins: [origin],
      trustedProxies: trusted ? ['127.0.0.1'] : [],
    });
    const client = new SQL(localDatabaseUrl('test'));
    const login = `audit_${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`;
    const password = 'audit secret password fixture';
    const userAgent = `Client/${login} '; DROP TABLE app.accounts; --`;
    let accountId: string | undefined;
    const post = (
      path: string,
      body: unknown,
      cookie?: string,
      headers: Record<string, string> = {},
    ) =>
      fetch(new URL(`/api/accounts/${path}`, runtime.server.url), {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
          'X-Client-Version': '2026.10.27',
          'X-Forwarded-For': '203.0.113.99, 198.51.100.42',
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        body: JSON.stringify(body),
      });
    const cookieOf = (response: Response) => response.headers.get('set-cookie')?.split(';')[0];

    try {
      const registered = await post('register', { login, password, nickname: 'Audit Player' });
      expect(registered.status).toBe(201);
      const [account] = await client<
        { id: string }[]
      >`SELECT id FROM app.accounts WHERE login_name = ${login}`;
      accountId = account?.id;
      expect(accountId).toBeDefined();
      const cookie = cookieOf(registered);
      const [audit] =
        await client`SELECT host(client_ip) AS ip, client_context FROM app.auth_audit WHERE account_id = ${accountId} AND event='register_success'`;
      expect(audit?.ip).toBe(trusted ? '198.51.100.42' : '127.0.0.1');
      expect(audit?.client_context).toEqual({ userAgent, clientVersion: '2026.10.27' });
      expect(JSON.stringify(audit)).not.toContain(password);
      expect(JSON.stringify(audit)).not.toContain(cookie?.split('=')[1] ?? 'unreachable');

      expect((await post('login', { login, password: 'wrong password fixture' })).status).toBe(401);
      const [failure] =
        await client`SELECT client_context FROM app.auth_audit WHERE event='login_failure' AND client_context->>'userAgent' = ${userAgent}`;
      expect(failure?.client_context).toEqual({ userAgent, clientVersion: '2026.10.27' });
      expect(
        (await post('register', { login, password, nickname: 'Audit Player', clientIp: '1.2.3.4' }))
          .status,
      ).toBe(400);
      const issued = await post('recovery-code', { password }, cookie);
      expect(issued.status).toBe(200);
      const recovery = recoveryResponseSchema.parse(await issued.json());
      expect(
        (
          await post('recover', {
            login,
            recoveryCode: recovery.recoveryCode,
            newPassword: 'new audit password fixture',
          })
        ).status,
      ).toBe(200);
      const relogin = await post('login', { login, password: 'new audit password fixture' });
      expect(relogin.status).toBe(200);
      expect(
        (
          await post(
            'password',
            { currentPassword: 'new audit password fixture', newPassword: password },
            cookieOf(relogin),
          )
        ).status,
      ).toBe(200);
      const signedIn = await post('login', { login, password });
      expect((await post('logout', {}, cookieOf(signedIn))).status).toBe(204);
      const malformed = await post('login', { login, password }, undefined, {
        'User-Agent': 'x'.repeat(513),
        'X-Client-Version': 'not a version',
      });
      expect(malformed.status).toBe(200);
      const [omitted] =
        await client`SELECT client_context FROM app.auth_audit WHERE account_id=${accountId} AND event='login_success' ORDER BY id DESC LIMIT 1`;
      expect(omitted?.client_context).toBeNull();
      const records = await client<
        { id: string; event: string }[]
      >`SELECT id::text, event FROM app.auth_audit WHERE account_id=${accountId}`;
      expect(records.map((r) => r.event)).toEqual(
        expect.arrayContaining([
          'register_success',
          'login_success',
          'logout',
          'recovery_code_issued',
          'password_recovered',
          'password_changed',
        ]),
      );
      const publicCatalog = await fetch(new URL('/api/catalog', runtime.server.url));
      expect(await publicCatalog.text()).not.toContain(userAgent);
      const preflight = await fetch(new URL('/api/accounts/login', runtime.server.url), {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,x-client-version',
        },
      });
      expect(preflight.headers.get('Access-Control-Allow-Headers')?.toLowerCase()).toContain(
        'x-client-version',
      );
      expect((await post('delete', { password }, cookieOf(malformed))).status).toBe(200);
      for (const record of records) {
        const [anonymous] =
          await client`SELECT account_id,client_ip,client_context FROM app.auth_audit WHERE id=${record.id}::bigint`;
        expect(anonymous).toEqual({ account_id: null, client_ip: null, client_context: null });
      }
    } finally {
      if (accountId) await client`DELETE FROM app.accounts WHERE id=${accountId}`;
      await client`DELETE FROM app.auth_audit WHERE client_context->>'userAgent'=${userAgent}`;
      await runtime.stop();
      await client.close();
    }
  }, 15_000);
}
