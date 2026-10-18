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
