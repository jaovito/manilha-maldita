import { expect, test } from 'bun:test';
import { unlink } from 'node:fs/promises';
import { loadPasswordBlocklist } from './password-blocklist';
import { createAccountSecurity } from './account-security';

test('password blocking preserves exact secrets and loads only a bounded optional local list', async () => {
  const baseline = await loadPasswordBlocklist({});
  expect(baseline('PasswordPassword')).toBe(true);
  expect(baseline('unique long password fixture')).toBe(false);
  const path = `/tmp/truco-blocklist-${crypto.randomUUID()}.txt`;

  try {
    await Bun.write(path, 'compromised fixture password\r\n\n');
    const blocked = await loadPasswordBlocklist({ PASSWORD_BLOCKLIST_FILE: path });
    const security = createAccountSecurity({ PASSWORD_PEPPER: 'ab'.repeat(32) }, blocked);
    await expect(security.hash('compromised fixture password')).rejects.toThrow('INVALID_PASSWORD');
    expect(blocked('COMPROMISED FIXTURE PASSWORD')).toBe(true);
    expect(blocked(' compromised fixture password')).toBe(false);
    await Bun.write(path, 'x'.repeat(129));
    await expect(loadPasswordBlocklist({ PASSWORD_BLOCKLIST_FILE: path })).rejects.toThrow(
      'INVALID_PASSWORD_BLOCKLIST',
    );
    await Bun.write(path, 'x\n'.repeat(100_001));
    await expect(loadPasswordBlocklist({ PASSWORD_BLOCKLIST_FILE: path })).rejects.toThrow(
      'INVALID_PASSWORD_BLOCKLIST',
    );
    await Bun.write(path, 'x'.repeat(8 * 1024 * 1024 + 1));
    await expect(loadPasswordBlocklist({ PASSWORD_BLOCKLIST_FILE: path })).rejects.toThrow(
      'INVALID_PASSWORD_BLOCKLIST',
    );
  } finally {
    await unlink(path);
  }
  for (const value of ['', `${path}-missing`])
    await expect(loadPasswordBlocklist({ PASSWORD_BLOCKLIST_FILE: value })).rejects.toThrow(
      'INVALID_PASSWORD_BLOCKLIST',
    );
});
