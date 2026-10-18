import { expect, test } from 'bun:test';
import { defaultRoomConfig } from '@truco/game-protocol';
import { startServer } from '../../src/bootstrap/runtime';

test('local defaults allow both loopback names and reject other origins before creating guests', async () => {
  const runtime = startServer({ port: 0 });
  try {
    for (const host of ['127.0.0.1', 'localhost']) {
      for (const port of [5173, 4173, 3001]) {
        const origin = `http://${host}:${port}`;
        const guest = await fetch(new URL('/api/guest', runtime.server.url), {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname: 'Ana' }),
        });
        expect(guest.status).toBe(201);
        const cookie = guest.headers.get('set-cookie')?.split(';')[0];
        if (!cookie) throw new Error('MISSING_COOKIE');

        const created = await fetch(new URL('/api/rooms', runtime.server.url), {
          method: 'POST',
          headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: defaultRoomConfig }),
        });
        expect(created.status).toBe(201);
        expect(await created.json()).toMatchObject({ code: expect.any(String) });
      }
    }

    for (const origin of ['', 'http://localhost:5174', 'http://localhost.evil.test:5173', 'null']) {
      const rejected = await fetch(new URL('/api/guest', runtime.server.url), {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: 'Ana' }),
      });
      expect(rejected.status).toBe(403);
      expect(await rejected.json()).toEqual({ code: 'FORBIDDEN_ORIGIN' });
      expect(rejected.headers.has('set-cookie')).toBe(false);
    }
  } finally {
    await runtime.stop();
  }
});

test('explicit allowed origins replace local defaults', async () => {
  const runtime = startServer({ port: 0, allowedOrigins: ['https://truco.example'] });
  try {
    const response = await fetch(new URL('/api/guest', runtime.server.url), {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Ana' }),
    });
    expect(response.status).toBe(403);
    expect(response.headers.has('set-cookie')).toBe(false);
  } finally {
    await runtime.stop();
  }
});
