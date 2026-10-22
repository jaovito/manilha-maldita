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

  const configured = { ...dependencies, policy: { ...policy } };

  return {
    sessionTtlMs: policy.sessionTtlMs,
    authenticate: (
      mode: 'register' | 'login',
      input: unknown,
      peer: string,
      previousToken?: unknown,
    ) => authenticate(configured, mode, input, peer, previousToken),

    async session(token: unknown) {
      const hash = await configured.tokenHash(token);

      return hash ? configured.repository.findSession(hash) : null;
    },

    async logout(token: unknown) {
      const hash = await configured.tokenHash(token);

      if (hash) await configured.repository.revokeSession(hash);
    },
  };
}

export type AccountApplication = ReturnType<typeof createAccountApplication>;
