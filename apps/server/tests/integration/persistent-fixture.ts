import { localDatabaseUrl } from '../../database/target';
import { fixturePepper } from '../../src/modules/accounts/adapters/outbound/tests/password-hasher-fixture';
import { withProgressionFixture } from '../database/progression-fixture';

export const persistentEnvironment = () => ({
  ENABLE_ACCOUNTS: 'true',
  NODE_ENV: 'test',
  DATABASE_URL: localDatabaseUrl('test'),
  PASSWORD_PEPPER: fixturePepper,
  JOB_POLL_INTERVAL_MS: '10',
  AUTH_LOGIN_ATTEMPTS: '100',
  AUTH_IP_ATTEMPTS: '200',
});

export const ensurePersistentCatalogs = () => withProgressionFixture(async () => {});
