import { expect, test } from 'bun:test';
import { createPlayerAuthenticator } from './player-authenticator';
import {
  flushAuthentication,
  playerAuthenticationFixture,
} from './tests/player-authentication-fixture';

test('account identity is server-derived and storage outages expire access closed', async () => {
  const f = playerAuthenticationFixture();
  let closes = 0;
  expect(await f.authenticator.resolve(undefined, 'bad')).toBeUndefined();
  expect(await f.authenticator.resolve(undefined, undefined)).toBeUndefined();
  const session = await f.session();
  expect(session.id).toBe('account_account-id');
  expect(f.authenticator.valid(session)).toBe(false);
  const release = f.authenticator.retain(session, () => {
    closes++;
  });
  expect(f.authenticator.valid(session)).toBe(true);
  f.setNow(2500);
  f.fire();
  await flushAuthentication();
  f.setNow(5001);
  expect(f.authenticator.valid(session)).toBe(true);
  f.base.state.failure = true;
  f.setNow(7600);
  f.fire();
  await flushAuthentication();
  expect(f.authenticator.valid(session)).toBe(false);
  expect(closes).toBe(1);
  release();
  await f.close();
  expect(() => f.authenticator.retain(session, () => {})).toThrow('SESSION_CAPACITY');
  expect(() =>
    createPlayerAuthenticator(
      f.accounts,
      f.players,
      f.guests,
      f.base.dependencies.tokenHash,
      f.runtime,
      0,
    ),
  ).toThrow('INVALID_AUTH_LEASE');
});

test('late close from an invalidated socket cannot remove its replacement lease', async () => {
  const f = playerAuthenticationFixture();
  let closes = 0;
  const first = await f.session();
  const releaseFirst = f.authenticator.retain(first, () => {
    closes++;
  });
  f.revoke({ tokenHash: 'b'.repeat(64) });
  expect(closes).toBe(1);
  expect(() => f.authenticator.retain(first, () => {})).toThrow('UNAUTHENTICATED');
  const replacement = await f.session();
  f.authenticator.retain(replacement, () => {
    closes++;
  });
  expect(f.authenticator.valid(first)).toBe(false);
  releaseFirst();
  expect(f.authenticator.valid(replacement)).toBe(true);
  f.revoke({ accountId: f.base.profile.accountId });
  expect(closes).toBe(2);
  expect(f.authenticator.valid(replacement)).toBe(false);
  await f.close();
});

test('revocation during a handshake and delayed validation cannot mint fresh authorization', async () => {
  const f = playerAuthenticationFixture();
  let complete: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    complete = resolve;
  });
  f.setLookup(async () => {
    await gate;
    return { ...f.base.profile, expiresAt: 86_400_000 };
  });
  const pending = f.resolve();
  await flushAuthentication();
  f.revoke({ accountId: f.base.profile.accountId });
  complete?.();
  expect(await pending).toBeUndefined();
  f.setLookup(async () => {
    f.setNow(6000);
    return { ...f.base.profile, expiresAt: 86_400_000 };
  });
  expect(await f.resolve()).toBeUndefined();
  await f.close();
});

test('refresh never overlaps and late database responses cannot extend an expired lease', async () => {
  const f = playerAuthenticationFixture();
  let complete: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    complete = resolve;
  });
  let calls = 0;
  let closes = 0;
  const session = await f.session();
  const reconnect = await f.session();
  f.authenticator.retain(session, () => {
    closes++;
  });
  f.setLookup(async () => {
    calls++;
    await gate;
    return { ...f.base.profile, expiresAt: 86_400_000 };
  });
  f.setNow(2500);
  f.fire();
  await flushAuthentication();
  // Another retain during the outstanding scan must not schedule a second refresh.
  f.authenticator.retain(reconnect, () => {});
  expect(f.timers.size).toBe(0);
  expect(calls).toBe(1);
  f.setNow(8000);
  expect(f.authenticator.valid(session)).toBe(false);
  complete?.();
  await flushAuthentication();
  expect(f.authenticator.valid(session)).toBe(false);
  expect(closes).toBe(1);
  await f.close();
});

test('unrelated token revocation does not invalidate a validated handshake', async () => {
  const f = playerAuthenticationFixture();
  const session = await f.session();
  f.revoke({ tokenHash: 'c'.repeat(64) });
  f.authenticator.retain(session, () => {});
  expect(f.authenticator.valid(session)).toBe(true);
  expect(() => f.authenticator.retain(session, () => {})).toThrow('UNAUTHENTICATED');
  await f.close();
});

test('a failing refresh for a retired lease cannot close a freshly validated replacement', async () => {
  const f = playerAuthenticationFixture();
  const first = await f.session();
  const releaseFirst = f.authenticator.retain(first, () => {});
  let reject: ((error: Error) => void) | undefined;
  const gate = new Promise<void>((_resolve, fail) => {
    reject = fail;
  });
  f.setLookup(async () => {
    await gate;
    return null;
  });
  f.setNow(2500);
  f.fire();
  await flushAuthentication();
  releaseFirst();
  f.setNow(3000);
  f.setLookup(async () => ({ ...f.base.profile, expiresAt: 86_400_000 }));
  const replacement = await f.session();
  let closed = false;
  f.authenticator.retain(replacement, () => {
    closed = true;
  });
  f.setNow(6000);
  reject?.(new Error('storage failure for retired lease'));
  await flushAuthentication();
  expect(closed).toBe(false);
  expect(f.authenticator.valid(replacement)).toBe(true);
  await f.close();
});
