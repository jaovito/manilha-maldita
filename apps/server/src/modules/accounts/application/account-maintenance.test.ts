import { expect, test } from 'bun:test';
import { createAccountMaintenance } from './account-maintenance';
import type { AccountMaintenanceRepository } from './ports/account-maintenance';
import { authenticationFixture } from './tests/authentication-fixture';

function fixture() {
  const auth = authenticationFixture();
  const state = { exists: true, commit: true, recovery: true };
  const events: string[] = [];
  const repository: AccountMaintenanceRepository = {
    async credentials() {
      return state.exists ? { login: 'player', passwordHash: 'correct-hash' } : null;
    },
    async setRecovery() {
      return state.commit;
    },
    async recoveryAccount() {
      return state.recovery ? auth.profile.accountId : null;
    },
    async reset() {
      return state.commit ? auth.profile.accountId : null;
    },
    async change() {
      return state.commit;
    },
    async delete() {
      return state.commit;
    },
    async audit(event) {
      events.push(event);
    },
  };
  const run = createAccountMaintenance({
    ...auth.dependencies,
    accounts: auth.app,
    repository,
    recovery: () => ({ code: 'c'.repeat(64), hash: 'd'.repeat(64) }),
    recoveryHash: (value) => (value === 'c'.repeat(64) ? 'd'.repeat(64) : null),
  });

  return { auth, state, events, run };
}

test('credential maintenance rejects malformed and throttled input before password work', async () => {
  const f = fixture();
  f.auth.state.allow = false;
  await expect(f.run('recover', {}, undefined, 'peer')).rejects.toThrow('AUTH_RATE_LIMITED');
  expect(f.auth.calls.verified).toEqual([]);
  f.auth.state.allow = true;
  for (const input of [null, [], {}, { password: 'correct password fixture', accountId: 'victim' }])
    await expect(f.run('delete', input, 'a'.repeat(64), 'peer')).rejects.toThrow(
      'INVALID_ACCOUNT_INPUT',
    );
  await expect(
    f.run(
      'recover',
      { login: "x'; --", recoveryCode: 'bad', newPassword: 'correct password fixture' },
      undefined,
      'peer',
    ),
  ).rejects.toThrow('INVALID_ACCOUNT_INPUT');
  await expect(
    f.run('password', { currentPassword: 'short', newPassword: 'short' }, 'a'.repeat(64), 'peer'),
  ).rejects.toThrow('INVALID_ACCOUNT_INPUT');
  await expect(
    f.run('delete', { password: 'wrong password fixture' }, 'a'.repeat(64), 'peer'),
  ).rejects.toThrow('INVALID_CREDENTIALS');
  f.state.exists = false;
  await expect(
    f.run('delete', { password: 'correct password fixture' }, 'a'.repeat(64), 'peer'),
  ).rejects.toThrow('INVALID_CREDENTIALS');
});

test('credential maintenance handles concurrent credential changes without claiming success', async () => {
  const f = fixture();
  const password = 'correct password fixture';
  const recover = { login: 'player', recoveryCode: 'c'.repeat(64), newPassword: password };
  f.state.recovery = false;
  await expect(f.run('recover', recover, undefined, 'peer')).rejects.toThrow('INVALID_CREDENTIALS');
  f.state.recovery = true;
  f.state.commit = false;
  for (const [mode, input] of [
    ['recover', recover],
    ['recovery-code', { password }],
    ['password', { currentPassword: password, newPassword: password }],
    ['delete', { password }],
  ] as const)
    await expect(f.run(mode, input, 'a'.repeat(64), 'peer')).rejects.toThrow('INVALID_CREDENTIALS');
  expect(f.events).toEqual([]);
});
