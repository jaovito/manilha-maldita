import { expect, test } from 'bun:test';
import { main, parseServerOptions } from './main';
import { DEFAULT_ORIGINS } from './runtime';

test('environment uses local defaults and validates explicit deployment origins', () => {
  expect(parseServerOptions({})).toEqual({
    environment: 'production',
    soloEnabled: false,
    devTools: false,
    hostname: '127.0.0.1',
    port: 3001,
    allowedOrigins: [...DEFAULT_ORIGINS],
    secureCookies: false,
  });
  expect(
    parseServerOptions({
      HOST: '0.0.0.0',
      PORT: '8080',
      SECURE_COOKIES: 'true',
      ALLOWED_ORIGINS: 'https://truco.example, https://truco.example/,http://localhost:5173',
    }),
  ).toEqual({
    environment: 'production',
    soloEnabled: false,
    devTools: false,
    hostname: '0.0.0.0',
    port: 8080,
    secureCookies: true,
    allowedOrigins: ['https://truco.example', 'http://localhost:5173'],
  });
  for (const PORT of ['', '-1', '65536', '1.5', '1e3', ' 3001', 'Infinity', '3001\n']) {
    expect(() => parseServerOptions({ PORT })).toThrow('INVALID_PORT');
  }
  for (const HOST of ['', 'localhost/path', ' localhost', 'http://localhost', 'localhost\n']) {
    expect(() => parseServerOptions({ HOST })).toThrow('INVALID_HOST');
  }
  expect(() => parseServerOptions({ SECURE_COOKIES: 'yes' })).toThrow('INVALID_SECURE_COOKIES');
  for (const ALLOWED_ORIGINS of [
    '',
    '*',
    'ftp://truco.test',
    'https://user:pass@truco.test',
    'https://truco.test/path',
    'https://truco.test?secret=value',
    'https://truco.test#fragment',
    'null',
  ]) {
    expect(() => parseServerOptions({ ALLOWED_ORIGINS })).toThrow('INVALID_ALLOWED_ORIGINS');
  }
});

test('main starts a real listener from explicit environment without exposing configuration', async () => {
  const runtime = await main({ PORT: '0', HOST: '127.0.0.1', SECURE_COOKIES: 'false' });
  try {
    const response = await fetch(new URL('/api/guest', runtime.server.url));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'UNAUTHENTICATED' });
  } finally {
    await runtime.stop();
  }
});

test('solo flag is independent and development tooling fails closed outside explicit development', () => {
  expect(
    parseServerOptions({ ENABLE_SOLO: 'true', ENABLE_DEV_TOOLS: 'true', NODE_ENV: 'production' }),
  ).toMatchObject({ soloEnabled: true, devTools: false });
  expect(parseServerOptions({ ENABLE_DEV_TOOLS: 'true', NODE_ENV: 'development' })).toMatchObject({
    soloEnabled: false,
    devTools: true,
  });
  expect(parseServerOptions({ ENABLE_DEV_TOOLS: 'true' }).devTools).toBe(false);
  for (const key of ['ENABLE_SOLO', 'ENABLE_DEV_TOOLS'])
    expect(() => parseServerOptions({ [key]: 'yes' })).toThrow('INVALID_FEATURE_FLAG');
});

test('entry lifecycle reports fixed codes and closes the listener on shutdown', async () => {
  const { shutdown, startupFailed } = await import('./main');
  const { spyOn } = await import('bun:test');
  const report = spyOn(console, 'error').mockImplementation(() => {});
  const previous = process.exitCode;

  try {
    const runtime = await main({ PORT: '0', NODE_ENV: 'test' });
    await shutdown(runtime);
    await shutdown({
      async stop() {
        throw new Error('private stop error');
      },
    });
    startupFailed();
    expect(report.mock.calls).toEqual([['SERVER_STOP_FAILED'], ['SERVER_START_FAILED']]);
    expect(process.exitCode).toBe(1);
    await expect(main({ PORT: '0', HOST: '192.0.2.1', NODE_ENV: 'test' })).rejects.toThrow();
  } finally {
    process.exitCode = previous ?? 0;
    report.mockRestore();
  }
});
