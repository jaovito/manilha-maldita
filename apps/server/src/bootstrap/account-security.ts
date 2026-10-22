import { createArgon2PasswordHasher } from '../modules/accounts/adapters/outbound/argon2-password-hasher';
import { PasswordService } from '../modules/accounts';
import { parseAccountSecurityEnvironment, type ServerEnvironment } from './environment';

/** Explicit composition only: the current guest server does not activate account authentication. */
export function createAccountSecurity(env: ServerEnvironment): PasswordService {
  const config = parseAccountSecurityEnvironment(env);
  const hasher = createArgon2PasswordHasher(config.argon2, config.pepper);

  return new PasswordService(hasher, config.maxConcurrent);
}
