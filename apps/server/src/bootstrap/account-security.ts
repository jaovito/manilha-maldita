import { PasswordService } from '../modules/accounts';
import { createArgon2PasswordHasher } from '../modules/accounts/adapters/outbound/argon2-password-hasher';
import { parseAccountSecurityEnvironment, type ServerEnvironment } from './environment';

/** Shared capacity applies across login, registration and credential maintenance. */
export function createAccountSecurity(
  env: ServerEnvironment,
  blocked?: (password: string) => boolean,
): PasswordService {
  const config = parseAccountSecurityEnvironment(env);
  const hasher = createArgon2PasswordHasher(config.argon2, config.pepper);

  return new PasswordService(hasher, config.maxConcurrent, blocked);
}
