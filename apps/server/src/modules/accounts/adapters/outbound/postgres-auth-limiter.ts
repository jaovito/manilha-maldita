import { createHmac, createSecretKey } from 'node:crypto';
import { isPasswordPepper } from '../../domain/argon2-policy';
import type { SQL } from 'bun';
import type { AttemptRule } from '../../application/ports/authentication';

/** Global rule must come first, bounding both expensive work and new per-peer/login keys. */
export function createPostgresAuthLimiter(client: SQL) {
  return async (rules: readonly AttemptRule[]): Promise<boolean> => {
    return client.begin(async (tx) => {
      await tx`SELECT set_config('statement_timeout', '5000', true), set_config('lock_timeout', '2000', true)`;

      // Bounded cleanup also runs on denied requests; no raw IP/login is retained.
      await tx`DELETE FROM app.auth_rate_limits WHERE key_hash IN (
        SELECT key_hash FROM app.auth_rate_limits WHERE expires_at <= statement_timestamp()
        ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED)`;

      for (const rule of rules) {
        const rows = await tx`INSERT INTO app.auth_rate_limits (key_hash, attempts, expires_at)
          VALUES (${rule.key}, 1, statement_timestamp() + ${rule.windowMs} * interval '1 millisecond')
          ON CONFLICT (key_hash) DO UPDATE SET attempts = CASE WHEN app.auth_rate_limits.expires_at <= statement_timestamp() THEN 1 ELSE app.auth_rate_limits.attempts + 1 END,
            expires_at = CASE WHEN app.auth_rate_limits.expires_at <= statement_timestamp()
              THEN statement_timestamp() + ${rule.windowMs} * interval '1 millisecond' ELSE app.auth_rate_limits.expires_at END
          WHERE app.auth_rate_limits.expires_at <= statement_timestamp() OR app.auth_rate_limits.attempts < ${rule.maximum} RETURNING key_hash`;

        if (!rows.length) return false;
      }

      return true;
    });
  };
}

/** Domain-separated HMAC keys avoid retaining raw IP addresses or attempted login names. */
export function createAuthRateKey(pepper: string): (value: string) => string {
  if (!isPasswordPepper(pepper)) throw new Error('INVALID_PASSWORD_PEPPER');

  const key = createSecretKey(Buffer.from(pepper, 'hex'));

  return (value) =>
    createHmac('sha256', key).update('account-attempt:').update(value).digest('hex');
}
