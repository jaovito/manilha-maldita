import { expect, test } from 'bun:test';
import { defaultRoomConfig } from '@truco/game-protocol';
import { startServer } from './runtime';

test('runtime serves authenticated HTTP using the real room service and closes idempotently', async () => {
  const runtime = startServer({
    port: 0,
    allowedOrigins: ['http://truco.test'],
    secureCookies: true,
  });
  try {
    const guest = await fetch(new URL('/api/guest', runtime.server.url), {
      method: 'POST',
      headers: { Origin: 'http://truco.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Ana' }),
    });
    expect(guest.status).toBe(201);
    const cookie = guest.headers.get('set-cookie')?.split(';')[0];
    if (!cookie) throw new Error('MISSING_COOKIE');
    expect(guest.headers.get('set-cookie')).toContain('Secure');
    const created = await fetch(new URL('/api/rooms', runtime.server.url), {
      method: 'POST',
      headers: { Cookie: cookie, Origin: 'http://truco.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: defaultRoomConfig }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ code: expect.any(String) });
  } finally {
    await runtime.stop();
    await runtime.stop();
  }
});

test('startup failure releases room service and transport resources', async () => {
  const runtime = startServer({ port: 0 });
  try {
    const port = runtime.server.port;
    if (port === undefined) throw new Error('MISSING_PORT');
    expect(() => startServer({ port })).toThrow();
  } finally {
    await runtime.stop();
  }
});

test('account routes are opt-in, keep guest routes available and require Secure cookies in production', async () => {
  const { authenticationFixture } = await import(
    '../modules/accounts/application/tests/authentication-fixture'
  );
  const fixture = authenticationFixture();
  expect(() => startServer({ accounts: fixture.app })).toThrow('SECURE_ACCOUNT_COOKIES_REQUIRED');
  const runtime = startServer({
    port: 0,
    environment: 'test',
    accounts: fixture.app,
    allowedOrigins: ['http://accounts.test'],
  });

  try {
    const response = await fetch(new URL('/api/accounts/login', runtime.server.url), {
      method: 'POST',
      headers: { Origin: 'http://accounts.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'player', password: 'correct password fixture' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ nickname: 'Player' });
    expect((await fetch(new URL('/api/guest', runtime.server.url))).status).toBe(401);
  } finally {
    await runtime.stop();
  }
});
