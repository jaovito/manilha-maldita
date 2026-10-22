import type { PasswordService } from '../services/password-service';

export type AccountProfile = Readonly<{ accountId: string; nickname: string }>;
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
  ): Promise<boolean>;
  findSession(tokenHash: string): Promise<AccountProfile | null>;
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
  tokenHash(value: unknown): Promise<string | null>;
}>;
