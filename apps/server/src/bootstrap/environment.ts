import {
  type AccountApplication,
  type Argon2Policy,
  type AuthenticationPolicy,
  isPasswordPepper,
  validateArgon2Policy,
  validateAuthenticationPolicy,
} from '../modules/accounts';
import type { Ports } from '../modules/rooms';
import { parseTrustedProxies } from '../shared/request-peer';
import type { BackendServices } from './backend-services';

export const DEFAULT_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:3001',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3001',
] as const;

export type ServerOptions = Readonly<{
  port?: number;
  hostname?: string;
  allowedOrigins?: readonly string[];
  secureCookies?: boolean;
  environment?: string;
  soloEnabled?: boolean;
  devTools?: boolean;
  accounts?: AccountApplication;
  backend?: BackendServices;
  trustedProxies?: readonly string[];
  ports?: Ports;
}>;

export const SERVER_DEFAULTS = {
  hostname: '127.0.0.1',
  port: 3001,
  environment: 'production',
  secureCookies: false,
  soloEnabled: false,
  devTools: false,
} as const;

const ACCOUNT_SECURITY_DEFAULTS = {
  ARGON2_MEMORY_KIB: 19_456,
  ARGON2_ITERATIONS: 2,
  ARGON2_MAX_MEMORY_KIB: 65_536,
  ARGON2_MAX_ITERATIONS: 6,
  PASSWORD_MAX_CONCURRENCY: 2,
  PASSWORD_MEMORY_BUDGET_KIB: 131_072,
} as const;

export type AccountSecurityEnvironment = Readonly<{
  argon2: Argon2Policy;
  maxConcurrent: number;
  memoryBudgetKiB: number;
  pepper: string;
}>;

export type ServerEnvironment = Readonly<Record<string, string | undefined>>;

export function parseServerOptions(env: ServerEnvironment): ServerOptions {
  for (const key of ['ENABLE_SOLO', 'ENABLE_DEV_TOOLS']) {
    if (env[key] !== undefined && env[key] !== 'true' && env[key] !== 'false')
      throw new Error('INVALID_FEATURE_FLAG');
  }

  const hostname = env.HOST ?? SERVER_DEFAULTS.hostname;
  const portText = env.PORT ?? String(SERVER_DEFAULTS.port);

  if (!hostname || /[^a-zA-Z0-9.:-]/.test(hostname)) throw new Error('INVALID_HOST');
  if (!portText || /[^0-9]/.test(portText)) throw new Error('INVALID_PORT');

  const port = Number(portText);

  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('INVALID_PORT');

  const secureText = env.SECURE_COOKIES ?? String(SERVER_DEFAULTS.secureCookies);

  if (secureText !== 'true' && secureText !== 'false') throw new Error('INVALID_SECURE_COOKIES');

  const origins =
    env.ALLOWED_ORIGINS === undefined
      ? [...DEFAULT_ORIGINS]
      : env.ALLOWED_ORIGINS.split(',').map((origin) => {
          try {
            const url = new URL(origin.trim());
            if (
              (url.protocol !== 'http:' && url.protocol !== 'https:') ||
              url.username ||
              url.password ||
              url.pathname !== '/' ||
              url.search ||
              url.hash
            )
              throw new Error('INVALID_ORIGIN');

            return url.origin;
          } catch {
            throw new Error('INVALID_ALLOWED_ORIGINS');
          }
        });

  return {
    hostname,
    port,
    ...(env.TRUSTED_PROXY_IPS !== undefined
      ? { trustedProxies: parseTrustedProxies(env.TRUSTED_PROXY_IPS) }
      : {}),
    environment: env.NODE_ENV ?? SERVER_DEFAULTS.environment,
    soloEnabled:
      env.ENABLE_SOLO === undefined ? SERVER_DEFAULTS.soloEnabled : env.ENABLE_SOLO === 'true',
    devTools:
      env.NODE_ENV === 'development' &&
      (env.ENABLE_DEV_TOOLS === undefined
        ? SERVER_DEFAULTS.devTools
        : env.ENABLE_DEV_TOOLS === 'true'),
    allowedOrigins: [...new Set(origins)],
    secureCookies: secureText === 'true',
  };
}

/** Parse only when account security is explicitly composed; guest-only startup needs no pepper. */
export function parseAccountSecurityEnvironment(
  env: ServerEnvironment,
): AccountSecurityEnvironment {
  try {
    const numberValue = (name: keyof typeof ACCOUNT_SECURITY_DEFAULTS): number => {
      const text = env[name];

      if (text === undefined) return ACCOUNT_SECURITY_DEFAULTS[name];
      if (!text || /[^0-9]/.test(text)) throw new Error();

      const value = Number(text);

      if (!Number.isSafeInteger(value)) throw new Error();

      return value;
    };

    const argon2: Argon2Policy = {
      memoryKiB: numberValue('ARGON2_MEMORY_KIB'),
      iterations: numberValue('ARGON2_ITERATIONS'),
      maxMemoryKiB: numberValue('ARGON2_MAX_MEMORY_KIB'),
      maxIterations: numberValue('ARGON2_MAX_ITERATIONS'),
    };
    validateArgon2Policy(argon2);

    const maxConcurrent = numberValue('PASSWORD_MAX_CONCURRENCY');
    const memoryBudgetKiB = numberValue('PASSWORD_MEMORY_BUDGET_KIB');

    if (
      maxConcurrent < 1 ||
      maxConcurrent > 8 ||
      memoryBudgetKiB < 19_456 ||
      memoryBudgetKiB > 262_144 ||
      argon2.maxMemoryKiB * maxConcurrent > memoryBudgetKiB ||
      !isPasswordPepper(env.PASSWORD_PEPPER)
    )
      throw new Error();

    return { argon2, maxConcurrent, memoryBudgetKiB, pepper: env.PASSWORD_PEPPER };
  } catch {
    // Never return validation details containing environment values or secrets.
    throw new Error('INVALID_ACCOUNT_SECURITY_ENVIRONMENT');
  }
}

const AUTHENTICATION_DEFAULTS = {
  AUTH_SESSION_TTL_MS: 86_400_000,
  AUTH_ATTEMPT_WINDOW_MS: 300_000,
  AUTH_LOGIN_ATTEMPTS: 5,
  AUTH_IP_ATTEMPTS: 20,
  AUTH_GLOBAL_ATTEMPTS: 200,
} as const;

export function parseAuthenticationPolicy(env: ServerEnvironment): AuthenticationPolicy {
  const read = (name: keyof typeof AUTHENTICATION_DEFAULTS): number => {
    const value = env[name];

    if (value === undefined) return AUTHENTICATION_DEFAULTS[name];
    if (!value || /[^0-9]/.test(value)) throw new Error('INVALID_AUTHENTICATION_POLICY');

    return Number(value);
  };
  const policy = {
    sessionTtlMs: read('AUTH_SESSION_TTL_MS'),
    attemptWindowMs: read('AUTH_ATTEMPT_WINDOW_MS'),
    loginAttempts: read('AUTH_LOGIN_ATTEMPTS'),
    ipAttempts: read('AUTH_IP_ATTEMPTS'),
    globalAttempts: read('AUTH_GLOBAL_ATTEMPTS'),
  };
  validateAuthenticationPolicy(policy);

  return policy;
}
