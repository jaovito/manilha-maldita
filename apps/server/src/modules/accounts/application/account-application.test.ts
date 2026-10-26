import { expect, test } from 'bun:test';
import { createAccountApplication } from './account-application';
import { authenticationFixture } from './tests/authentication-fixture';

const login = { login: 'player', password: 'correct password fixture' };

test('account use cases validate strict input, throttle before hashing and return only authenticated profiles', async () => {
  const fixture = authenticationFixture();
  expect(
    await fixture.app.authenticate('register', { ...login, nickname: ' Player ' }, 'peer'),
  ).toEqual({ token: 'a'.repeat(64), profile: fixture.profile });
  expect(await fixture.app.authenticate('login', login, 'peer')).toEqual({
    token: 'a'.repeat(64),
    profile: fixture.profile,
  });

  for (const input of [
    null,
    [],
    {},
    { ...login, xp: 999 },
    { ...login, password: 123 },
    { ...login, login: "' OR 1=1--" },
  ])
    await expect(fixture.app.authenticate('login', input, 'peer')).rejects.toThrow(
      'INVALID_ACCOUNT_INPUT',
    );

  for (const nickname of [undefined, '', 'a'.repeat(25), '<script>'])
    await expect(
      fixture.app.authenticate('register', { ...login, nickname }, 'peer'),
    ).rejects.toThrow('INVALID_ACCOUNT_INPUT');

  fixture.state.allow = false;
  await expect(fixture.app.authenticate('login', login, 'peer')).rejects.toThrow(
    'AUTH_RATE_LIMITED',
  );
  expect(fixture.calls.verified).toEqual(['correct-hash']);
});

test('missing, disabled and incorrect credentials fail generically after password verification', async () => {
  const fixture = authenticationFixture();
  fixture.state.exists = false;
  await expect(fixture.app.authenticate('login', login, 'peer')).rejects.toThrow(
    'INVALID_CREDENTIALS',
  );
  expect(fixture.calls.verified).toEqual(['$argon2id$dummy-fixture']);
  fixture.state.exists = true;
  fixture.state.active = false;
  await expect(fixture.app.authenticate('login', login, 'peer')).rejects.toThrow(
    'INVALID_CREDENTIALS',
  );
  fixture.state.active = true;
  await expect(
    fixture.app.authenticate('login', { ...login, password: 'wrong password fixture' }, 'peer'),
  ).rejects.toThrow('INVALID_CREDENTIALS');
  fixture.state.issue = false;
  await expect(fixture.app.authenticate('login', login, 'peer')).rejects.toThrow(
    'INVALID_CREDENTIALS',
  );
  fixture.state.duplicate = true;
  await expect(
    fixture.app.authenticate('register', { ...login, nickname: 'Player' }, 'peer'),
  ).rejects.toThrow('REGISTRATION_FAILED');
});

test('session lookup and logout ignore invalid tokens and use repository verifiers for valid ones', async () => {
  const fixture = authenticationFixture();
  expect(await fixture.app.session(null)).toBeNull();
  expect(await fixture.app.session('a'.repeat(64))).toEqual({
    ...fixture.profile,
    expiresAt: 86_400_000,
  });
  await fixture.app.logout(null);
  await fixture.app.logout('a'.repeat(64));
  expect(fixture.calls.revoked).toBe(1);
});

test('policy rejects invalid ranges and copies mutable configuration', () => {
  const { dependencies } = authenticationFixture();
  for (const change of [
    { sessionTtlMs: 0 },
    { sessionTtlMs: 86_400_001 },
    { attemptWindowMs: 0 },
    { attemptWindowMs: 900_001 },
    { loginAttempts: 0 },
    { ipAttempts: 1001 },
    { globalAttempts: 1.2 },
  ])
    expect(() =>
      createAccountApplication({ ...dependencies, policy: { ...dependencies.policy, ...change } }),
    ).toThrow('INVALID_AUTHENTICATION_POLICY');
  expect(() =>
    createAccountApplication({ ...dependencies, dummyPasswordHash: 'plaintext' }),
  ).toThrow('INVALID_AUTHENTICATION_POLICY');
});
