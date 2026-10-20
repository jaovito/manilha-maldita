import { expect, test } from 'bun:test';
import { InMemorySessionRepository } from '../adapters/outbound/in-memory-session-repository';
import { createSessionApplication } from './session-application';

test('capacity rejection does not allocate credentials; expiry reclaims capacity', () => {
  let now = 20;
  let allocated = 0;
  const repository = new InMemorySessionRepository();
  const application = createSessionApplication({
    repository,
    now: () => now,
    credentials: () => {
      allocated++;
      return { id: `identity-${allocated}`, token: `credential-${allocated}` };
    },
    maximum: 2,
    ttlMs: 100,
  });

  const first = application.issue('Ana');
  now = 30;
  const second = application.issue('Beto');
  expect(() => application.issue('Caio')).toThrow('SESSION_CAPACITY');
  expect(allocated).toBe(2);

  now = 120;
  const third = application.issue('Caio');
  expect(repository.size).toBe(2);
  expect(application.find(first.token)).toBeUndefined();
  expect(application.find(second.token)).toEqual(second.session);
  expect(application.find(third.token)).toEqual(third.session);
  expect(allocated).toBe(3);
});

test('rename neither mutates existing snapshots nor extends lifetime', () => {
  let now = 0;
  const repository = new InMemorySessionRepository();
  const application = createSessionApplication({
    repository,
    now: () => now,
    credentials: () => ({ id: 'identity', token: 'credential' }),
    maximum: 1,
    ttlMs: 100,
  });
  const original = application.issue('Ana');

  now = 99;
  expect(application.rename(original.token, 'Bia')).toEqual({
    id: 'identity',
    nickname: 'Bia',
    expiresAt: 100,
  });
  expect(original.session.nickname).toBe('Ana');

  now = 100;
  expect(application.rename(original.token, 'Caio')).toBeUndefined();
  expect(repository.find(original.token)?.nickname).toBe('Bia');
  expect(application.find(original.token)).toBeUndefined();
  expect(repository.size).toBe(0);

  application.clear();
  expect(application.find(undefined)).toBeUndefined();
  expect(application.find('')).toBeUndefined();
  expect(application.rename('unknown', 'Dani')).toBeUndefined();
});
