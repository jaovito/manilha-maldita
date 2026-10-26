import { isPassword } from '../../domain/credential-policy';
import { isCommonPassword } from '../../domain/password-blocklist';
import type { PasswordHasher } from '../ports/password-hasher';

const MAX_CONCURRENT_HASHES = 8;

/** Share one instance per process. Reject overload instead of retaining queued passwords. */
export class PasswordService {
  private active = 0;

  constructor(
    private readonly hasher: PasswordHasher,
    private readonly maximum: number,
    private readonly blocked: (password: string) => boolean = isCommonPassword,
  ) {
    if (!Number.isInteger(maximum) || maximum < 1 || maximum > MAX_CONCURRENT_HASHES)
      throw new Error('INVALID_PASSWORD_CAPACITY');
  }

  async hash(password: unknown): Promise<string> {
    if (!isPassword(password) || this.blocked(password)) throw new Error('INVALID_PASSWORD');

    return this.run(() => this.hasher.hash(password));
  }

  async verify(password: unknown, passwordHash: unknown): Promise<boolean> {
    if (!isPassword(password) || typeof passwordHash !== 'string') return false;

    return this.run(() => this.hasher.verify(password, passwordHash));
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.maximum) throw new Error('PASSWORD_CAPACITY_EXCEEDED');

    this.active++;

    try {
      return await operation();
    } catch {
      // Operational errors cannot expose credential material from an adapter.
      throw new Error('PASSWORD_HASHING_UNAVAILABLE');
    } finally {
      this.active--;
    }
  }
}
