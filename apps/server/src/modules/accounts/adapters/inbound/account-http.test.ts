import { expect, test } from 'bun:test';
import { Hono } from 'hono';
import { authenticationFixture } from '../../application/tests/authentication-fixture';
import { registerAccountRoutes } from './account-http';

const origin = 'http://accounts.test';
const login = { login: 'player', password: 'correct password fixture' };

test('account HTTP validates JSON, origins, sizes and cookies without returning bearer/hash material', async () => {
  const fixture = authenticationFixture();
  const app = new Hono();
  registerAccountRoutes(app, fixture.app, [origin], true);
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(`/api/accounts/${path}`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  const response = await post('register', { ...login, nickname: 'Player' });
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ nickname: 'Player' });
  expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
  expect(response.headers.get('Set-Cookie')).toContain('Secure');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect((await post('login', login)).status).toBe(200);
  expect((await post('login', login, { Origin: 'https://evil.test' })).status).toBe(403);
  expect((await post('login', login, { 'Content-Type': 'text/plain' })).status).toBe(400);
  expect(
    (
      await app.request('/api/accounts/login', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: '{',
      })
    ).status,
  ).toBe(400);
  expect((await post('login', { password: 'x'.repeat(9000) })).status).toBe(413);
  expect((await app.request('/api/accounts/session')).status).toBe(401);
  expect(
    (
      await app.request('/api/accounts/session', {
        headers: { Cookie: `truco_account=${'a'.repeat(64)}` },
      })
    ).status,
  ).toBe(200);
  expect((await post('logout', {})).status).toBe(204);

  fixture.state.allow = false;
  expect((await post('login', login)).status).toBe(429);
  fixture.state.allow = true;
  fixture.state.failure = true;
  const unavailable = await post('login', login);
  expect(unavailable.status).toBe(503);
  expect(await unavailable.json()).toEqual({ code: 'AUTH_UNAVAILABLE' });
  expect(
    (
      await app.request('/api/accounts/session', {
        headers: { Cookie: `truco_account=${'a'.repeat(64)}` },
      })
    ).status,
  ).toBe(503);
  expect((await post('logout', {}, { Cookie: `truco_account=${'a'.repeat(64)}` })).status).toBe(
    503,
  );
});
