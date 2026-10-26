export type AuthAuditEvent =
  | 'register_success'
  | 'register_failure'
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'recovery_code_issued'
  | 'password_recovered'
  | 'password_changed'
  | 'account_deleted';

export type AccountMaintenanceRepository = Readonly<{
  credentials(accountId: string): Promise<{ login: string; passwordHash: string } | null>;
  setRecovery(
    accountId: string,
    expectedPasswordHash: string,
    recoveryHash: string,
  ): Promise<boolean>;
  recoveryAccount(login: string, recoveryHash: string): Promise<string | null>;
  reset(
    login: string,
    expectedRecoveryHash: string,
    newPasswordHash: string,
    newRecoveryHash: string,
  ): Promise<string | null>;
  change(
    accountId: string,
    expectedPasswordHash: string,
    newPasswordHash: string,
  ): Promise<boolean>;
  delete(accountId: string, expectedPasswordHash: string): Promise<boolean>;
  audit(event: AuthAuditEvent, accountId?: string): Promise<void>;
}>;
