import { expect, test } from 'bun:test';
import { isPasswordPepper, validateArgon2Policy, type Argon2Policy } from './argon2-policy';

const policy: Argon2Policy = {
  memoryKiB: 19_456,
  iterations: 2,
  maxMemoryKiB: 65_536,
  maxIterations: 6,
};

test('Argon2 policy enforces safe generation costs and independent verification caps', () => {
  expect(() => validateArgon2Policy(policy)).not.toThrow();
  expect(() =>
    validateArgon2Policy({
      memoryKiB: 262_144,
      iterations: 10,
      maxMemoryKiB: 262_144,
      maxIterations: 10,
    }),
  ).not.toThrow();

  for (const change of [
    { memoryKiB: 19_455 },
    { memoryKiB: 19_456.5 },
    { memoryKiB: NaN },
    { maxMemoryKiB: 262_145 },
    { maxMemoryKiB: 19_455 },
    { maxMemoryKiB: Infinity },
    { iterations: 1 },
    { iterations: 2.5 },
    { maxIterations: 1 },
    { maxIterations: 11 },
    { maxIterations: NaN },
  ])
    expect(() => validateArgon2Policy({ ...policy, ...change })).toThrow(/^INVALID_ARGON2_POLICY$/);
});

test('pepper format is exact, rejects coercion and requires a 256-bit hex secret', () => {
  expect(isPasswordPepper('ab'.repeat(32))).toBe(true);

  for (const value of [
    null,
    undefined,
    {},
    123,
    '',
    'a'.repeat(63),
    'a'.repeat(65),
    'A'.repeat(64),
    'g'.repeat(64),
    `${'a'.repeat(64)}\n`,
  ])
    expect(isPasswordPepper(value)).toBe(false);
});
