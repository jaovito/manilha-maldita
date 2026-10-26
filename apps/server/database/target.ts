export type DatabaseTarget = 'development' | 'test';
export type DatabaseEnvironment = Record<string, string | undefined>;

export function localDatabaseUrl(target: DatabaseTarget, env: DatabaseEnvironment = process.env) {
  if (env.NODE_ENV === 'production')
    throw new Error('Local database tools cannot run in production.');
  const test = target === 'test';
  const value = test ? env.TEST_DATABASE_URL : env.DATABASE_URL;
  const fallback = test
    ? 'postgresql://truco_test:truco_test_local@127.0.0.1:55433/truco_test'
    : 'postgresql://truco:truco_local@127.0.0.1:55432/truco_dev';
  let url: URL;
  try {
    url = new URL(value ?? fallback);
  } catch {
    throw new Error('Invalid local database URL.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.pathname !== (test ? '/truco_test' : '/truco_dev') ||
    url.username !== (test ? 'truco_test' : 'truco') ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Database tools require the designated local database and role for this target.',
    );
  }
  return url.toString();
}

/** Deployment migration credentials are explicit and never fall back to local defaults. */
export function productionMigrationUrl(env: DatabaseEnvironment) {
  try {
    if (env.NODE_ENV !== 'production' || !env.DATABASE_URL) throw new Error();

    const url = new URL(env.DATABASE_URL);

    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      !url.password ||
      url.pathname.length < 2 ||
      url.hash ||
      url.searchParams.getAll('sslmode').length !== 1 ||
      url.searchParams.get('sslmode') !== 'verify-full' ||
      [...url.searchParams.keys()].some((key) => key !== 'sslmode')
    )
      throw new Error();

    return url.toString();
  } catch {
    throw new Error('INVALID_MIGRATION_ENVIRONMENT');
  }
}
