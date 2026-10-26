import { expect, test } from 'bun:test';
import { PasswordService } from '../../index';
import { createArgon2PasswordHasher } from './argon2-password-hasher';
import {
  fixtureArgon2Policy,
  fixturePepper,
  passwordHasherFixture,
} from './tests/password-hasher-fixture';

const password = 'fixture password with spaces';

test('real Argon2id hashes use the supported cost, independent salts and verify exact input', async () => {
  const service = new PasswordService(passwordHasherFixture(), 2);
  const first = await service.hash(password);
  const second = await service.hash(password);

  expect(first).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  expect(first).not.toBe(second);
  expect(first).not.toContain(password);
  expect(await service.verify(password, first)).toBe(true);
  expect(await service.verify(password, second)).toBe(true);
  expect(await service.verify(`${password} `, first)).toBe(false);
  expect(await service.verify('another valid password', first)).toBe(false);
});

test('real hashing preserves SQL-like text, whitespace, Unicode and maximum length', async () => {
  const service = new PasswordService(passwordHasherFixture(), 2);

  for (const literal of ["  ' OR 1=1; --  ", '🃏'.repeat(128), 'á'.repeat(15)]) {
    const hash = await service.hash(literal);

    expect(await service.verify(literal, hash)).toBe(true);
    expect(await service.verify(literal.normalize('NFD').trim() + 'x', hash)).toBe(false);
  }

  const composed = await service.hash('á'.repeat(15));
  expect(await service.verify('a\u0301'.repeat(15), composed)).toBe(false);
});

test('unsupported, malformed or excessive stored costs fail closed before expensive verification', async () => {
  const service = new PasswordService(passwordHasherFixture(), 2);
  const hash = await service.hash(password);

  for (const value of [
    '',
    password,
    hash.replace('argon2id', 'argon2i'),
    hash.replace('v=19', 'v=16'),
    hash.replace('m=19456', 'm=999999999'),
    hash.replace('t=2', 't=999999999'),
    hash.replace('p=1', 'p=99'),
    hash.replace('m=19456', 'm=8'),
    hash.slice(0, -1),
    `${hash}\n`,
    `${hash}\r`,
    `${hash}\u2028`,
    `${hash}extra`,
  ])
    expect(await service.verify(password, value)).toBe(false);
});

test('real password hashing also respects the application capacity limit', async () => {
  const service = new PasswordService(passwordHasherFixture(), 1);
  const pending = service.hash(password);

  await expect(service.hash(password)).rejects.toThrow('PASSWORD_CAPACITY_EXCEEDED');
  const hash = await pending;
  expect(await service.verify(password, hash)).toBe(true);
});

test('peppered hashes require the configured secret and cannot verify raw or concatenated passwords', async () => {
  const hasher = passwordHasherFixture();
  const hash = await hasher.hash(password);
  const wrongKey = createArgon2PasswordHasher(fixtureArgon2Policy, 'cd'.repeat(32));

  expect(await hasher.verify(password, hash)).toBe(true);
  expect(await wrongKey.verify(password, hash)).toBe(false);
  expect(await Bun.password.verify(password, hash)).toBe(false);
  expect(await Bun.password.verify(`${password}:${fixturePepper}`, hash)).toBe(false);

  const unpeppered = await Bun.password.hash(password, {
    algorithm: 'argon2id',
    memoryCost: 19_456,
    timeCost: 2,
  });
  expect(await hasher.verify(password, unpeppered)).toBe(false);
});

test('cost changes preserve supported old hashes while configured verification caps reject expensive hashes', async () => {
  const policy = { ...fixtureArgon2Policy };
  const original = createArgon2PasswordHasher(policy, fixturePepper);
  const oldHash = await original.hash(password);
  const increased = createArgon2PasswordHasher(
    { ...policy, memoryKiB: 20_480, iterations: 3 },
    fixturePepper,
  );
  const newHash = await increased.hash(password);

  expect(newHash).toMatch(/^\$argon2id\$v=19\$m=20480,t=3,p=1\$/);
  expect(await increased.verify(password, oldHash)).toBe(true);
  expect(await increased.verify(password, newHash)).toBe(true);
  expect(await original.verify(password, newHash)).toBe(true);

  const capped = createArgon2PasswordHasher(
    { ...policy, maxMemoryKiB: 19_456, maxIterations: 2 },
    fixturePepper,
  );
  expect(await capped.verify(password, newHash)).toBe(false);
  expect(await capped.verify(password, oldHash.replace('t=2', 't=7'))).toBe(false);
  expect(await capped.verify(password, oldHash.replace('m=19456', 'm=65537'))).toBe(false);
  expect(await capped.verify(password, oldHash.replace('t=2', 't=1'))).toBe(false);

  policy.memoryKiB = 20_480;
  policy.maxMemoryKiB = 20_480;
  const unaffected = await original.hash(password);
  expect(unaffected).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
});

test('adapter creation rejects missing, malformed or short peppers without leaking values', () => {
  for (const pepper of ['', 'short-secret', 'a'.repeat(63), 'A'.repeat(64), `${fixturePepper}\n`])
    expect(() => createArgon2PasswordHasher(fixtureArgon2Policy, pepper)).toThrow(
      /^INVALID_PASSWORD_PEPPER$/,
    );
});
