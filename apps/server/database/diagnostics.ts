const hints = {
  INVALID_MIGRATION_ENVIRONMENT:
    'Set NODE_ENV=production and an explicit DATABASE_URL with sslmode=verify-full and no other URL options.',
  INVALID_LOCAL_DATABASE_TARGET:
    'Local tools require the designated local database. Hosted migrations require NODE_ENV=production.',
  INVALID_DATABASE_COMMAND:
    'Use migrate or seed, optionally followed by --test. Seeds and test targets are local-only.',
  DATABASE_TLS_FAILED:
    'Check the trusted certificate chain and hostname. Do not disable certificate verification.',
  DATABASE_CONNECTION_FAILED:
    'Check database availability, DNS, port, network access and TLS configuration.',
  DATABASE_AUTHENTICATION_FAILED:
    'Check the deployment database credentials and authentication policy.',
  DATABASE_PERMISSION_DENIED:
    'The deployment role needs the reviewed schema and migration privileges.',
  DATABASE_NOT_FOUND: 'Check that the configured database exists.',
  DATABASE_CAPACITY_EXCEEDED: 'Check the database connection limit and available capacity.',
  DATABASE_OPERATION_TIMED_OUT: 'Check competing migration locks and database operation duration.',
  MIGRATION_HISTORY_CONFLICT:
    'Inspect existing objects and migration history. Do not reset or drop production data.',
  MIGRATION_SQL_FAILED:
    'Inspect the reviewed migration and database compatibility using authorized database tools.',
  MIGRATION_FILES_MISSING: 'Include the versioned migrations and journal in the deployed artifact.',
  DATABASE_COMMAND_FAILED:
    'Check the target and migration state using authorized operational tools.',
} as const;

type Category = keyof typeof hints;
export type DatabasePhase = 'configuration' | 'connection' | 'lock' | 'migration' | 'seed';
const phases: readonly string[] = ['configuration', 'connection', 'lock', 'migration', 'seed'];

const codes: Readonly<Record<string, Category>> = {
  DEPTH_ZERO_SELF_SIGNED_CERT: 'DATABASE_TLS_FAILED',
  SELF_SIGNED_CERT_IN_CHAIN: 'DATABASE_TLS_FAILED',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'DATABASE_TLS_FAILED',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'DATABASE_TLS_FAILED',
  CERT_HAS_EXPIRED: 'DATABASE_TLS_FAILED',
  CERT_UNTRUSTED: 'DATABASE_TLS_FAILED',
  ERR_TLS_CERT_ALTNAME_INVALID: 'DATABASE_TLS_FAILED',
  ERR_TLS_CERTIFICATE_VERIFY_FAILED: 'DATABASE_TLS_FAILED',
  ERR_POSTGRES_TLS_NOT_AVAILABLE: 'DATABASE_TLS_FAILED',
  ECONNREFUSED: 'DATABASE_CONNECTION_FAILED',
  ECONNRESET: 'DATABASE_CONNECTION_FAILED',
  ETIMEDOUT: 'DATABASE_CONNECTION_FAILED',
  ENOTFOUND: 'DATABASE_CONNECTION_FAILED',
  EAI_AGAIN: 'DATABASE_CONNECTION_FAILED',
  ERR_POSTGRES_CONNECTION_TIMEOUT: 'DATABASE_CONNECTION_FAILED',
  ERR_POSTGRES_CONNECTION_REFUSED: 'DATABASE_CONNECTION_FAILED',
  ERR_POSTGRES_CONNECTION_CLOSED: 'DATABASE_CONNECTION_FAILED',
  ERR_POSTGRES_SERVER_CLOSED_CONNECTION: 'DATABASE_CONNECTION_FAILED',
  '28P01': 'DATABASE_AUTHENTICATION_FAILED',
  '28000': 'DATABASE_AUTHENTICATION_FAILED',
  '42501': 'DATABASE_PERMISSION_DENIED',
  '3D000': 'DATABASE_NOT_FOUND',
  '53300': 'DATABASE_CAPACITY_EXCEEDED',
  '55P03': 'DATABASE_OPERATION_TIMED_OUT',
  '57014': 'DATABASE_OPERATION_TIMED_OUT',
  '40P01': 'DATABASE_OPERATION_TIMED_OUT',
  '42P06': 'MIGRATION_HISTORY_CONFLICT',
  '42P07': 'MIGRATION_HISTORY_CONFLICT',
  '42710': 'MIGRATION_HISTORY_CONFLICT',
  '42601': 'MIGRATION_SQL_FAILED',
  '42703': 'MIGRATION_SQL_FAILED',
  '42P01': 'MIGRATION_SQL_FAILED',
  '42883': 'MIGRATION_SQL_FAILED',
  ENOENT: 'MIGRATION_FILES_MISSING',
};

const configurationMessages: Readonly<Record<string, Category>> = {
  INVALID_MIGRATION_ENVIRONMENT: 'INVALID_MIGRATION_ENVIRONMENT',
  'Invalid local database URL.': 'INVALID_LOCAL_DATABASE_TARGET',
  'Database tools require the designated local database and role for this target.':
    'INVALID_LOCAL_DATABASE_TARGET',
  'Local database tools cannot run in production.': 'INVALID_DATABASE_COMMAND',
  'Use migrate or seed, optionally followed by --test.': 'INVALID_DATABASE_COMMAND',
};

function property(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;

  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}

/** Only known categories escape; unknown messages, SQL, paths and credentials are discarded. */
export function databaseFailureCategory(error: unknown): Category {
  let current = error;

  for (let depth = 0; depth < 5 && current !== undefined && current !== null; depth++) {
    const category = property(current, 'category');
    if (typeof category === 'string' && Object.hasOwn(hints, category)) return category as Category;

    for (const key of ['errno', 'code']) {
      const value = property(current, key);
      if (typeof value === 'string' && Object.hasOwn(codes, value)) return codes[value]!;
    }

    const message = property(current, 'message');
    if (typeof message === 'string' && Object.hasOwn(configurationMessages, message))
      return configurationMessages[message]!;

    current = property(current, 'cause');
  }

  return 'DATABASE_COMMAND_FAILED';
}

export class DatabaseCommandError extends Error {
  readonly category: Category;

  constructor(
    error: unknown,
    readonly phase: DatabasePhase,
  ) {
    super('DATABASE_COMMAND_FAILED');
    this.category = databaseFailureCategory(error);
  }
}

export function databaseFailureMessage(error: unknown): string {
  const category = databaseFailureCategory(error);
  const suppliedPhase = property(error, 'phase');
  const phase =
    typeof suppliedPhase === 'string' && phases.includes(suppliedPhase)
      ? suppliedPhase
      : category.startsWith('INVALID_')
        ? 'configuration'
        : 'unknown';

  return `Database command failed [${category}; phase=${phase}]. ${hints[category]}`;
}
