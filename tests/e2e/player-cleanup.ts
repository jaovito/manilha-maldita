import { SQL } from 'bun';
import { localDatabaseUrl } from '../../apps/server/database/target';

/** Only known browser fixtures in the guarded local test database are eligible. */
export default async function cleanupPlayerFixtures() {
  const client = new SQL(localDatabaseUrl('test'));

  try {
    const rows = await client`SELECT login_name FROM app.accounts
      WHERE starts_with(login_name, 'earned_') OR starts_with(login_name, 'browser_')`;
    for (const row of rows) {
      const login = String(row.login_name);
      if (!/^(earned|browser)_[a-f0-9]{20}$/.test(login)) continue;

      const password = login.startsWith('earned_')
        ? 'Copper lanterns above the quiet river 847!'
        : 'TruC06';
      const headers = {
        Origin: 'http://127.0.0.1:3001',
        'Content-Type': 'application/json',
      };
      const auth = await fetch('http://127.0.0.1:3001/api/accounts/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ login, password }),
      });
      if (!auth.ok) throw new Error('BROWSER_FIXTURE_LOGIN_FAILED');

      const cookie = auth.headers.get('Set-Cookie')?.split(';')[0];
      if (!cookie) throw new Error('MISSING_BROWSER_FIXTURE_COOKIE');

      const result = await fetch('http://127.0.0.1:3001/api/accounts/delete', {
        method: 'POST',
        headers: { ...headers, Cookie: cookie },
        body: JSON.stringify({ password }),
      });
      if (!result.ok) throw new Error('BROWSER_FIXTURE_DELETE_FAILED');
    }
  } finally {
    await client.close();
  }
}

if (import.meta.main) await cleanupPlayerFixtures();
