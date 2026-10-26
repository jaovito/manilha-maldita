import { expect, test } from 'bun:test';
import { Hono } from 'hono';
import { parseTrustedProxies, proxyPeer, requestPeer } from './request-peer';

test('forwarding is accepted only through explicit actual proxy peers and parsed right to left', async () => {
  const trusted = parseTrustedProxies('127.0.0.1, ::1, 127.0.0.1');
  expect(trusted).toEqual(['127.0.0.1', '::1']);
  expect(parseTrustedProxies(undefined)).toEqual([]);
  expect(parseTrustedProxies('')).toEqual([]);
  for (const value of [
    '*',
    '0.0.0.0/0',
    'localhost',
    '1.2.3.999',
    Array(33).fill('127.0.0.1').join(','),
  ])
    expect(() => parseTrustedProxies(value)).toThrow('INVALID_TRUSTED_PROXIES');
  expect(proxyPeer('203.0.113.1', '198.51.100.1', trusted)).toBe('203.0.113.1');
  expect(proxyPeer('127.0.0.1', '198.51.100.1, 203.0.113.1, ::1', trusted)).toBe('203.0.113.1');
  for (const header of [
    undefined,
    '',
    'invalid',
    '127.0.0.1, ::1',
    'x'.repeat(2049),
    Array(17).fill('1.2.3.4').join(','),
  ])
    expect(proxyPeer('127.0.0.1', header, trusted)).toBe('127.0.0.1');
  const app = new Hono();
  app.get('/', (context) => context.text(requestPeer(context, trusted)));
  expect(await (await app.request('/', { headers: { 'X-Forwarded-For': '1.2.3.4' } })).text()).toBe(
    'local',
  );
});
