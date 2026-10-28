import { expect, test } from 'bun:test';
import { normalizeAuditContext } from './audit-context';

test('audit context accepts bounded IP/client hints and discards unrelated data', () => {
  for (const clientIp of ['127.0.0.1', '::1', '::ffff:192.0.2.1']) {
    expect(
      normalizeAuditContext({
        clientIp,
        clientContext: {
          userAgent: "Test/1.0 '; DROP TABLE app.accounts; --",
          clientVersion: '2026.10.27-abc_1',
          cookie: 'secret',
          password: 'secret',
        },
      }),
    ).toEqual({
      clientIp,
      clientContext: {
        userAgent: "Test/1.0 '; DROP TABLE app.accounts; --",
        clientVersion: '2026.10.27-abc_1',
      },
    });
  }
  expect(
    normalizeAuditContext({
      clientIp: '192.0.2.1/24',
      clientContext: { userAgent: 'a'.repeat(512), clientVersion: 'a'.repeat(64) },
    }).clientContext,
  ).toEqual({ userAgent: 'a'.repeat(512), clientVersion: 'a'.repeat(64) });
});

test('malformed, control-bearing and oversized telemetry is omitted without rejecting auth', () => {
  for (const value of [
    null,
    undefined,
    1,
    [],
    'secret',
    { clientIp: 'local' },
    { clientIp: 'fe80::1%eth0' },
    { clientContext: [] },
  ])
    expect(normalizeAuditContext(value)).toEqual({ clientIp: null, clientContext: {} });
  for (const userAgent of [
    null,
    10,
    '',
    'x'.repeat(513),
    '😀'.repeat(129),
    'a\nb',
    'a\rb',
    'a\u0085b',
  ])
    expect(normalizeAuditContext({ clientContext: { userAgent } }).clientContext).toEqual({});
  for (const clientVersion of [
    null,
    1,
    '',
    'a'.repeat(65),
    'version with space',
    '1.0\n',
    '<script>',
  ])
    expect(normalizeAuditContext({ clientContext: { clientVersion } }).clientContext).toEqual({});
});
