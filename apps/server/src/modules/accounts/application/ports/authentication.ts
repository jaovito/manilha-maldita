import type { AuthAuditContext } from './audit';
import type { PasswordService } from '../services/password-service';
import type { AuthAuditEvent } from './account-maintenance';

export type AccountProfile = Readonly<{ accountId: string; nickname: string }>;
export type AccountSessionProfile = AccountProfile & Readonly<{ expiresAt: number }>;
export type LoginRecord = AccountProfile & Readonly<{ passwordHash: string; active: boolean }>;
export type AttemptRule = Readonly<{ key: string; maximum: number; windowMs: number }>;

export type AccountRepository = Readonly<{
  register(
    login: string,
    passwordHash: string,
    nickname: string,
    tokenHash: string,
    ttlMs: number,
  ): Promise<AccountProfile | null>;
  findLogin(login: string): Promise<LoginRecord | null>;
  issueSession(
    accountId: string,
    tokenHash: string,
    ttlMs: number,
    previousHash: string | null,
    verifiedPasswordHash: string,
  ): Promise<boolean>;
  findSession(tokenHash: string): Promise<AccountSessionProfile | null>;
  revokeSession(tokenHash: string): Promise<void>;
}>;

export type AuthenticationPolicy = Readonly<{
  sessionTtlMs: number;
  attemptWindowMs: number;
  loginAttempts: number;
  ipAttempts: number;
  globalAttempts: number;
}>;

export type AuthenticationDependencies = Readonly<{
  repository: AccountRepository;
  passwords: PasswordService;
  dummyPasswordHash: string;
  policy: AuthenticationPolicy;
  allowAttempts(rules: readonly AttemptRule[]): Promise<boolean>;
  rateKey(value: string): string;
  credentials(): Promise<{ token: string; tokenHash: string }>;
  onRevoked?: (event: Readonly<{ tokenHash: string } | { accountId: string }>) => void;
  tokenHash(value: unknown): Promise<string | null>;
  audit?: (event: AuthAuditEvent, accountId?: string, context?: AuthAuditContext) => Promise<void>;
}>;
