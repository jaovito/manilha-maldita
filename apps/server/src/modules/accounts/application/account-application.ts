import type { AuthenticationDependencies, AuthenticationPolicy } from './ports/authentication';
import { authenticate } from './use-cases/authenticate';

export function validateAuthenticationPolicy(policy: AuthenticationPolicy): void {
  if (
    !Number.isSafeInteger(policy.sessionTtlMs) ||
    policy.sessionTtlMs < 60_000 ||
    policy.sessionTtlMs > 86_400_000 ||
    !Number.isSafeInteger(policy.attemptWindowMs) ||
    policy.attemptWindowMs < 1_000 ||
    policy.attemptWindowMs > 900_000 ||
    [policy.loginAttempts, policy.ipAttempts, policy.globalAttempts].some(
      (value) => !Number.isSafeInteger(value) || value < 1 || value > 1_000,
    )
  )
    throw new Error('INVALID_AUTHENTICATION_POLICY');
}

export function createAccountApplication(dependencies: AuthenticationDependencies) {
  const policy = dependencies.policy;
  validateAuthenticationPolicy(policy);

  if (!dependencies.dummyPasswordHash.startsWith('$argon2id$'))
    throw new Error('INVALID_AUTHENTICATION_POLICY');

  type Revocation = Readonly<{ tokenHash: string } | { accountId: string }>;
  const listeners = new Set<(event: Revocation) => void>();
  const revoke = (event: Revocation) => {
    dependencies.onRevoked?.(event);

    for (const listener of listeners) listener(event);
  };
  const configured = { ...dependencies, onRevoked: revoke, policy: { ...policy } };

  return {
    sessionTtlMs: policy.sessionTtlMs,
    revoke,
    subscribeRevocations(listener: (event: Revocation) => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    authenticate: (
      mode: 'register' | 'login',
      input: unknown,
      peer: string,
      previousToken?: unknown,
    ) =>
      (async () => {
        try {
          const result = await authenticate(configured, mode, input, peer, previousToken);
          await configured.audit?.(
            mode === 'register' ? 'register_success' : 'login_success',
            result.profile.accountId,
          );

          return result;
        } catch (error) {
          // Denied traffic is counted by the limiter without growing an unbounded audit stream.
          if (
            error instanceof Error &&
            ['INVALID_CREDENTIALS', 'REGISTRATION_FAILED', 'INVALID_PASSWORD'].includes(
              error.message,
            )
          )
            await configured.audit?.(mode === 'register' ? 'register_failure' : 'login_failure');

          throw error;
        }
      })(),

    async sessionByHash(hash: string) {
      if (hash.length !== 64 || /[^a-f0-9]/.test(hash)) return null;

      return configured.repository.findSession(hash);
    },

    async session(token: unknown) {
      const hash = await configured.tokenHash(token);

      return hash ? configured.repository.findSession(hash) : null;
    },

    async logout(token: unknown) {
      const hash = await configured.tokenHash(token);

      if (hash) {
        await configured.repository.revokeSession(hash);
        configured.onRevoked?.({ tokenHash: hash });
        await configured.audit?.('logout');
      }
    },
  };
}

export type AccountApplication = ReturnType<typeof createAccountApplication>;
