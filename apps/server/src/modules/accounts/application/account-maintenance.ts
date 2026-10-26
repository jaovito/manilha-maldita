import { isLoginName, isPassword } from '../domain/credential-policy';
import type { AccountApplication } from './account-application';
import type { AccountMaintenanceRepository } from './ports/account-maintenance';
import type { AuthenticationDependencies } from './ports/authentication';

type Dependencies = Pick<
  AuthenticationDependencies,
  'passwords' | 'policy' | 'allowAttempts' | 'rateKey' | 'dummyPasswordHash'
> &
  Readonly<{
    accounts: AccountApplication;
    repository: AccountMaintenanceRepository;
    recovery(): { code: string; hash: string };
    recoveryHash(value: unknown): string | null;
  }>;

export function createAccountMaintenance(deps: Dependencies) {
  return async (
    mode: 'recovery-code' | 'recover' | 'password' | 'delete',
    input: unknown,
    token: unknown,
    peer: string,
  ) => {
    const fields =
      mode === 'recover'
        ? ['login', 'recoveryCode', 'newPassword']
        : mode === 'password'
          ? ['currentPassword', 'newPassword']
          : ['password'];
    const value =
      input && typeof input === 'object' && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
    const login = isLoginName(value.login) ? value.login : null;
    const { policy } = deps;
    const rules = [
      {
        key: deps.rateKey('global'),
        maximum: policy.globalAttempts,
        windowMs: policy.attemptWindowMs,
      },
      {
        key: deps.rateKey(`ip:${peer}`),
        maximum: policy.ipAttempts,
        windowMs: policy.attemptWindowMs,
      },
      ...(login
        ? [
            {
              key: deps.rateKey(`login:${login}`),
              maximum: policy.loginAttempts,
              windowMs: policy.attemptWindowMs,
            },
          ]
        : []),
    ];

    if (!(await deps.allowAttempts(rules))) throw new Error('AUTH_RATE_LIMITED');
    if (Object.keys(value).length !== fields.length || fields.some((key) => !(key in value)))
      throw new Error('INVALID_ACCOUNT_INPUT');

    if (mode === 'recover') {
      const hash = deps.recoveryHash(value.recoveryCode);

      if (!login || !hash || !isPassword(value.newPassword))
        throw new Error('INVALID_ACCOUNT_INPUT');

      const accountId = await deps.repository.recoveryAccount(login, hash);

      if (!accountId) throw new Error('INVALID_CREDENTIALS');

      const passwordHash = await deps.passwords.hash(value.newPassword);
      const recovery = deps.recovery();
      const changed = await deps.repository.reset(login, hash, passwordHash, recovery.hash);

      if (!changed) throw new Error('INVALID_CREDENTIALS');

      deps.accounts.revoke({ accountId: changed });
      await deps.repository.audit('password_recovered', changed);

      return { recoveryCode: recovery.code };
    }

    const account = await deps.accounts.session(token);

    if (!account) throw new Error('UNAUTHENTICATED');

    const password = mode === 'password' ? value.currentPassword : value.password;

    if (!isPassword(password) || (mode === 'password' && !isPassword(value.newPassword)))
      throw new Error('INVALID_ACCOUNT_INPUT');

    const credentials = await deps.repository.credentials(account.accountId);

    if (
      credentials &&
      !(await deps.allowAttempts([
        {
          key: deps.rateKey(`login:${credentials.login}`),
          maximum: policy.loginAttempts,
          windowMs: policy.attemptWindowMs,
        },
      ]))
    )
      throw new Error('AUTH_RATE_LIMITED');

    const verified = await deps.passwords.verify(
      password,
      credentials?.passwordHash ?? deps.dummyPasswordHash,
    );

    if (!verified || !credentials) throw new Error('INVALID_CREDENTIALS');

    if (mode === 'recovery-code') {
      const recovery = deps.recovery();

      if (
        !(await deps.repository.setRecovery(
          account.accountId,
          credentials.passwordHash,
          recovery.hash,
        ))
      )
        throw new Error('INVALID_CREDENTIALS');

      await deps.repository.audit('recovery_code_issued', account.accountId);

      return { recoveryCode: recovery.code };
    }

    const changed =
      mode === 'delete'
        ? await deps.repository.delete(account.accountId, credentials.passwordHash)
        : await deps.repository.change(
            account.accountId,
            credentials.passwordHash,
            await deps.passwords.hash(value.newPassword),
          );

    if (!changed) throw new Error('INVALID_CREDENTIALS');

    deps.accounts.revoke({ accountId: account.accountId });
    await deps.repository.audit(
      mode === 'delete' ? 'account_deleted' : 'password_changed',
      mode === 'delete' ? undefined : account.accountId,
    );

    return {};
  };
}

export type AccountMaintenance = ReturnType<typeof createAccountMaintenance>;
