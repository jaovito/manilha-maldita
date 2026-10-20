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
