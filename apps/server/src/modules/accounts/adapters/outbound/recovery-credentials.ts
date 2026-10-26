import { createHash, randomBytes } from 'node:crypto';

export function hashRecoveryCode(code: unknown): string | null {
  if (typeof code !== 'string' || code.length !== 64 || /[^a-f0-9]/.test(code)) return null;

  return createHash('sha256').update('account-recovery:').update(code).digest('hex');
}

export function createRecoveryCode(): { code: string; hash: string } {
  const code = randomBytes(32).toString('hex');
  const hash = hashRecoveryCode(code);

  if (!hash) throw new Error('RECOVERY_CREDENTIALS_UNAVAILABLE');

  return { code, hash };
}
