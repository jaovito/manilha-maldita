import { createAccountApplication } from '../account-application';
import type { AccountRepository, AuthenticationDependencies } from '../ports/authentication';
import { PasswordService } from '../services/password-service';

export function authenticationFixture() {
  const profile = { accountId: 'account-id', nickname: 'Player' };
  const calls = { verified: [] as string[], attempts: 0, issued: 0, revoked: 0 };
  const state = {
    allow: true,
    exists: true,
    active: true,
    duplicate: false,
    issue: true,
    failure: false,
  };
  const repository: AccountRepository = {
    async register() {
      return state.duplicate ? null : profile;
    },
    async findLogin() {
      if (state.failure) throw new Error('secret database detail');

      return state.exists
        ? { ...profile, passwordHash: 'correct-hash', active: state.active }
        : null;
    },
    async issueSession() {
      calls.issued++;
      return state.issue;
    },
    async findSession() {
      if (state.failure) throw new Error('secret database detail');
      return { ...profile, expiresAt: 86_400_000 };
    },
    async revokeSession() {
      calls.revoked++;
      if (state.failure) throw new Error('secret database detail');
    },
  };
  const dependencies: AuthenticationDependencies = {
    repository,
    passwords: new PasswordService(
      {
        async hash() {
          return 'correct-hash';
        },
        async verify(password, hash) {
          calls.verified.push(hash);
          return password === 'correct password fixture';
        },
      },
      2,
    ),
    dummyPasswordHash: '$argon2id$dummy-fixture',
    policy: {
      sessionTtlMs: 86_400_000,
      attemptWindowMs: 300_000,
      loginAttempts: 5,
      ipAttempts: 20,
      globalAttempts: 200,
    },
    async allowAttempts() {
      calls.attempts++;
      return state.allow;
    },
    rateKey: (value) => value,
    async credentials() {
      return { token: 'a'.repeat(64), tokenHash: 'b'.repeat(64) };
    },
    async tokenHash(value) {
      return value === 'a'.repeat(64) ? 'b'.repeat(64) : null;
    },
  };

  return { app: createAccountApplication(dependencies), dependencies, state, calls, profile };
}
