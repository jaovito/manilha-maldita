import { createHmac, createSecretKey } from 'node:crypto';
import type { PasswordHasher } from '../../application/ports/password-hasher';
import {
  type Argon2Policy,
  isPasswordPepper,
  validateArgon2Policy,
} from '../../domain/argon2-policy';

const PHC_FORMAT =
  /^\$argon2id\$v=19\$m=([0-9]{1,6}),t=([0-9]{1,2}),p=1\$[A-Za-z0-9+/]{43}\$[A-Za-z0-9+/]{43}(?![\s\S])/;

export function createArgon2PasswordHasher(policy: Argon2Policy, pepper: string): PasswordHasher {
  validateArgon2Policy(policy);

  if (!isPasswordPepper(pepper)) throw new Error('INVALID_PASSWORD_PEPPER');

  const { memoryKiB, iterations, maxMemoryKiB, maxIterations } = policy;
  const key = createSecretKey(Buffer.from(pepper, 'hex'));
  const prepare = (password: string) =>
    createHmac('sha256', key).update(password, 'utf8').digest('hex');

  return {
    hash(password: string): Promise<string> {
      return Bun.password.hash(prepare(password), {
        algorithm: 'argon2id',
        memoryCost: memoryKiB,
        timeCost: iterations,
      });
    },

    async verify(password: string, passwordHash: string): Promise<boolean> {
      const match = PHC_FORMAT.exec(passwordHash);

      if (!match) return false;

      const storedMemoryKiB = Number(match[1]);
      const storedIterations = Number(match[2]);

      if (
        storedMemoryKiB < 19_456 ||
        storedMemoryKiB > maxMemoryKiB ||
        storedIterations < 2 ||
        storedIterations > maxIterations
      )
        return false;

      return Bun.password.verify(prepare(password), passwordHash, 'argon2id');
    },
  };
}
