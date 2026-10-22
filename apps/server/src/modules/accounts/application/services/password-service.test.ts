import { expect, test } from 'bun:test';
import { PasswordService, type PasswordHasher } from '../../index';

const password = 'fixture password with spaces';

function hasherFixture() {
  const calls: unknown[][] = [];
  const hasher: { hash: PasswordHasher['hash']; verify: PasswordHasher['verify'] } = {
    async hash(value) {
      calls.push(['hash', value]);
      return 'fixture-hash';
    },

    async verify(value, hash) {
      calls.push(['verify', value, hash]);
      return value === password;
    },
  };

  return { hasher, calls };
}

test('service rejects invalid input before expensive work and preserves exact passwords', async () => {
  const fixture = hasherFixture();
  const service = new PasswordService(fixture.hasher, 2);

  await expect(service.hash('short')).rejects.toThrow('INVALID_PASSWORD');
  expect(await service.verify('short', 'hash')).toBe(false);
  expect(await service.verify(password, null)).toBe(false);
  expect(fixture.calls).toEqual([]);

  const literal = "  ' OR 1=1; --  ";
  expect(await service.hash(literal)).toBe('fixture-hash');
  expect(await service.verify(password, 'stored-hash')).toBe(true);
  expect(await service.verify('different password', 'stored-hash')).toBe(false);
  expect(fixture.calls).toEqual([
    ['hash', literal],
    ['verify', password, 'stored-hash'],
    ['verify', 'different password', 'stored-hash'],
  ]);
});

test('hash and verification share a bounded capacity without queuing extra credentials', async () => {
  const gate = Promise.withResolvers<string>();
  const verification = Promise.withResolvers<boolean>();
  const fixture = hasherFixture();
  fixture.hasher.hash = () => gate.promise;
  fixture.hasher.verify = () => verification.promise;
  const service = new PasswordService(fixture.hasher, 2);

  const first = service.hash(password);
  const second = service.verify(password, 'stored-hash');
  await expect(service.hash(password)).rejects.toThrow('PASSWORD_CAPACITY_EXCEEDED');
  await expect(service.verify(password, 'stored-hash')).rejects.toThrow(
    'PASSWORD_CAPACITY_EXCEEDED',
  );

  gate.resolve('first-hash');
  verification.resolve(true);
  expect(await first).toBe('first-hash');
  expect(await second).toBe(true);
  expect(await service.hash(password)).toBe('first-hash');
});

test('adapter failures are sanitized and release capacity after async or synchronous failures', async () => {
  for (const fail of [
    () => {
      throw new Error(password);
    },
    () => Promise.reject(new Error(password)),
  ]) {
    const fixture = hasherFixture();
    const originalHash = fixture.hasher.hash;
    fixture.hasher.hash = fail;
    const service = new PasswordService(fixture.hasher, 1);

    await expect(service.hash(password)).rejects.toThrow(/^PASSWORD_HASHING_UNAVAILABLE$/);
    fixture.hasher.hash = originalHash;
    expect(await service.hash(password)).toBe('fixture-hash');
  }
});

test('capacity accepts its inclusive bounds and rejects invalid configuration', async () => {
  for (const limit of [0, 9, 1.5, NaN, Infinity])
    expect(() => new PasswordService(hasherFixture().hasher, limit)).toThrow(
      'INVALID_PASSWORD_CAPACITY',
    );

  for (const limit of [1, 8]) {
    const service = new PasswordService(hasherFixture().hasher, limit);
    expect(await service.hash(password)).toBe('fixture-hash');
  }
});
