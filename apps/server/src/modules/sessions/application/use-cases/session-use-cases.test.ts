import { expect, mock, test } from 'bun:test';
import type { GuestSession } from '../../domain/entities/guest-session';
import type { SessionRepository } from '../ports/session-repository';
import { findSession } from './find-session';
import { issueSession } from './issue-session';
import { renameSession } from './rename-session';

function fakeRepository(session?: GuestSession) {
  return {
    size: session ? 1 : 0,
    find: mock(() => session),
    save: mock((_token: string, _session: GuestSession) => {}),
    remove: mock((_token: string) => {}),
    removeExpired: mock((_time: number) => {}),
    clear: mock(() => {}),
  } satisfies SessionRepository;
}

test('issue uses injected identity and time and propagates a failed repository write', () => {
  const repository = fakeRepository();
  const dependencies = {
    repository,
    now: () => 10,
    credentials: () => ({ id: 'independent-id', token: 'opaque-token' }),
    maximum: 2,
    ttlMs: 100,
  };

  expect(issueSession(dependencies, 'Ana')).toEqual({
    token: 'opaque-token',
    session: { id: 'independent-id', nickname: 'Ana', expiresAt: 110 },
  });
  expect(repository.removeExpired).toHaveBeenCalledWith(10);
  expect(repository.save).toHaveBeenCalledWith('opaque-token', {
    id: 'independent-id',
    nickname: 'Ana',
    expiresAt: 110,
  });

  repository.save.mockImplementation(() => {
    throw new Error('storage unavailable');
  });
  expect(() => issueSession(dependencies, 'Bia')).toThrow('storage unavailable');
});

test('credential failure does not save a session or produce a successful result', () => {
  const repository = fakeRepository();
  const credentials = () => {
    throw new Error('entropy unavailable');
  };

  expect(() =>
    issueSession({ repository, credentials, now: () => 0, maximum: 2, ttlMs: 100 }, 'Ana'),
  ).toThrow('entropy unavailable');
  expect(repository.save).not.toHaveBeenCalled();
});

test('find never queries storage without a credential and removes expired records', () => {
  const repository = fakeRepository({ id: 'id', nickname: 'Ana', expiresAt: 100 });
  const dependencies = { repository, now: () => 100 };

  expect(findSession(dependencies, undefined)).toBeUndefined();
  expect(repository.find).not.toHaveBeenCalled();
  expect(findSession(dependencies, 'opaque-token')).toBeUndefined();
  expect(repository.remove).toHaveBeenCalledWith('opaque-token');
});

test('rename fails without writing after expiry and propagates failed writes while active', () => {
  const repository = fakeRepository({ id: 'id', nickname: 'Ana', expiresAt: 100 });

  expect(renameSession({ repository, now: () => 100 }, 'token', 'Bia')).toBeUndefined();
  expect(repository.save).not.toHaveBeenCalled();
  expect(repository.remove).not.toHaveBeenCalled();

  repository.save.mockImplementation(() => {
    throw new Error('storage unavailable');
  });
  expect(() => renameSession({ repository, now: () => 99 }, 'token', 'Bia')).toThrow(
    'storage unavailable',
  );
});
