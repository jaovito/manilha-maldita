import { expect, test } from 'bun:test';
import { defaultRoomConfig } from '@truco/game-protocol';
import { createRuntimePorts, startServer } from './runtime';

test('runtime ports clamp backward clock steps and generate opaque IDs and bounded secure entropy', () => {
  let time = 100;
  let sample = 2 ** 32 - 1;
  const ports = createRuntimePorts({
    wallTime: () => time,
    randomValues(values) {
      values[0] = sample;
      sample = 11;
    },
  });
  expect(ports.now()).toBe(100);
  time = 50;
  expect(ports.now()).toBe(100);
  time = 120;
  expect(ports.now()).toBe(120);
  expect(ports.randomInt(10)).toBe(1);
  expect(ports.randomInt(1)).toBe(0);
  expect(ports.id()).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  for (const bound of [0, -1, 0.5, NaN, Infinity, 2 ** 32 + 1]) {
    expect(() => ports.randomInt(bound)).toThrow('INVALID_RANDOM_BOUND');
  }
  const production = createRuntimePorts();
  for (const bound of [1, 2, 3, 40, 2 ** 32]) {
    const result = production.randomInt(bound);
    expect(Number.isInteger(result) && result >= 0 && result < bound).toBe(true);
  }
});

test('scheduler rearms early and long wakes, cancels safely and never executes synchronously', () => {
  let time = 0;
  const timers: { delay: number; callback: () => void; cancelled: boolean }[] = [];
  const ports = createRuntimePorts({
    wallTime: () => time,
    timer(delay, callback) {
      const timer = { delay, callback, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  });
  let calls = 0;
  const cancel = ports.schedule(3000000000, () => {
    calls++;
  });
  const first = timers.at(-1);
  if (!first) throw new Error('MISSING_TIMER');
  expect(first.delay).toBe(2147483647);
  time = 2000000000;
  first.callback();
  const second = timers.at(-1);
  if (!second) throw new Error('MISSING_TIMER');
  expect(second.delay).toBe(1000000000);
  expect(calls).toBe(0);
  cancel();
  expect(second.cancelled).toBe(true);
  time = 3000000000;
  second.callback();
  expect(calls).toBe(0);
  ports.schedule(time - 1, () => {
    calls++;
  });
  const overdue = timers.at(-1);
  if (!overdue) throw new Error('MISSING_TIMER');
  expect(overdue.delay).toBe(1);
  expect(calls).toBe(0);
  overdue.callback();
  expect(calls).toBe(1);
  for (const at of [-1, NaN, Infinity])
    expect(() => ports.schedule(at, () => {})).toThrow('INVALID_SCHEDULE_TIME');
  // Exercise the real timer adapter without relying on elapsed wall time.
  createRuntimePorts().schedule(Date.now() + 60000, () => {
    throw new Error('CANCEL_FAILED');
  })();
});

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
