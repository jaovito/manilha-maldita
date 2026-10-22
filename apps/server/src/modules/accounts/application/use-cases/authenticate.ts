import { isLoginName, isPassword } from '../../domain/credential-policy';
import type { AccountProfile, AuthenticationDependencies } from '../ports/authentication';

function decode(input: unknown, register: boolean) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const fields = Object.keys(input);
  const value = input as Record<string, unknown>;
  const allowed = register ? ['login', 'password', 'nickname'] : ['login', 'password'];

  if (fields.length !== allowed.length || fields.some((key) => !allowed.includes(key))) return null;
  if (!isLoginName(value.login) || !isPassword(value.password)) return null;

  let nickname = '';

  if (register) {
    if (typeof value.nickname !== 'string') return null;

    nickname = value.nickname.trim();

    if (!nickname || nickname.length > 24 || /[^\p{L}\p{N} _.-]/u.test(nickname)) return null;
  }

  return { login: value.login, password: value.password, nickname };
}

/** Same generic login failure and one password verification for missing/disabled/wrong credentials. */
export async function authenticate(
  dependencies: AuthenticationDependencies,
  mode: 'register' | 'login',
  input: unknown,
  peer: string,
  previousToken: unknown,
): Promise<{ token: string; profile: AccountProfile }> {
  const { policy } = dependencies;
  const register = mode === 'register';
  const parsed = decode(input, register);
  const rules = [
    {
      key: dependencies.rateKey('global'),
      maximum: policy.globalAttempts,
      windowMs: policy.attemptWindowMs,
    },
    {
      key: dependencies.rateKey(`ip:${peer}`),
      maximum: policy.ipAttempts,
      windowMs: policy.attemptWindowMs,
    },
  ];

  if (parsed)
    rules.push({
      key: dependencies.rateKey(`login:${parsed.login}`),
      maximum: policy.loginAttempts,
      windowMs: policy.attemptWindowMs,
    });

  if (!(await dependencies.allowAttempts(rules))) throw new Error('AUTH_RATE_LIMITED');
  if (!parsed) throw new Error('INVALID_ACCOUNT_INPUT');

  const credentials = await dependencies.credentials();
  let profile: AccountProfile | null;

  if (register) {
    const hash = await dependencies.passwords.hash(parsed.password);
    profile = await dependencies.repository.register(
      parsed.login,
      hash,
      parsed.nickname,
      credentials.tokenHash,
      policy.sessionTtlMs,
    );

    if (!profile) throw new Error('REGISTRATION_FAILED');
  } else {
    const account = await dependencies.repository.findLogin(parsed.login);
    const verified = await dependencies.passwords.verify(
      parsed.password,
      account?.passwordHash ?? dependencies.dummyPasswordHash,
    );

    if (!verified || !account?.active) throw new Error('INVALID_CREDENTIALS');

    profile = { accountId: account.accountId, nickname: account.nickname };

    const previousHash = await dependencies.tokenHash(previousToken);
    const issued = await dependencies.repository.issueSession(
      profile.accountId,
      credentials.tokenHash,
      policy.sessionTtlMs,
      previousHash,
    );

    if (!issued) throw new Error('INVALID_CREDENTIALS');
  }

  return { token: credentials.token, profile };
}
