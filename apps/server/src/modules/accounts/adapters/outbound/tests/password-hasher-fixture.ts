import type { Argon2Policy } from '../../../domain/argon2-policy';
import { createArgon2PasswordHasher } from '../argon2-password-hasher';

export const fixturePepper = 'ab'.repeat(32);
export const fixtureArgon2Policy: Argon2Policy = {
  memoryKiB: 19_456,
  iterations: 2,
  maxMemoryKiB: 65_536,
  maxIterations: 6,
};

export function passwordHasherFixture() {
  return createArgon2PasswordHasher(fixtureArgon2Policy, fixturePepper);
}
