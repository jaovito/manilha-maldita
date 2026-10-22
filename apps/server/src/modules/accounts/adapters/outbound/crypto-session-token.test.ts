import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { createAccountSessionToken, hashAccountSessionToken } from './crypto-session-token';

test('account sessions issue independent opaque 256-bit bearers and SHA-256 verifiers', async () => {
  const first = await createAccountSessionToken();
  const second = await createAccountSessionToken();

  expect(first.token).toMatch(/^[a-f0-9]{64}$/);
  expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  expect(first.token).not.toBe(second.token);
  expect(first.tokenHash).not.toBe(second.tokenHash);
  expect(first.tokenHash).not.toBe(first.token);
  expect(first.tokenHash).toBe(createHash('sha256').update(first.token).digest('hex'));
  expect(await hashAccountSessionToken(first.token)).toBe(first.tokenHash);
  expect(await hashAccountSessionToken(first.token)).toBe(first.tokenHash);
  expect(await hashAccountSessionToken(second.token)).toBe(second.tokenHash);
});

test('invalid bearer types, lengths, casing and SQL-like values are rejected without coercion', async () => {
  for (const value of [
    null,
    undefined,
    0,
    {},
    [],
    '',
    'a'.repeat(63),
    'a'.repeat(65),
    'A'.repeat(64),
    'g'.repeat(64),
    `${'a'.repeat(64)}\n`,
    `${'a'.repeat(64)}\r`,
    `${'a'.repeat(64)}\u2028`,
    `${'a'.repeat(63)}\0`,
    "' OR 1=1; --",
    ' a'.repeat(32),
  ])
    expect(await hashAccountSessionToken(value)).toBeNull();
});
