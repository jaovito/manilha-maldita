import { expect, test } from 'bun:test';
import { createLimiter, createSessions } from './sessions';
test('sessions use independent credentials and expire at the boundary with bounded capacity', () => {
  let now = 10;
  const sessions = createSessions(() => now, 1, 100);
  const first = sessions.issue('Ana');
  expect(first.token).not.toBe(first.session.id);
  expect(sessions.find(first.token)).toEqual(first.session);
  expect(sessions.find(undefined)).toBeUndefined();
  expect(sessions.find('invalid')).toBeUndefined();
  expect(() => sessions.issue('Beto')).toThrow('SESSION_CAPACITY');
  now = 110;
  expect(sessions.find(first.token)).toBeUndefined();
  const second = sessions.issue('Beto');
  now = 210;
  const third = sessions.issue('Carlos');
  expect(third.token).not.toBe(second.token);
  sessions.clear();
  expect(sessions.find(third.token)).toBeUndefined();
});
test('limits activity, memory and windows deterministically', () => {
  let now = 0;
  const limiter = createLimiter(() => now, 1);
  expect(limiter.allow('a', 2, 100)).toBe(true);
  expect(limiter.allow('a', 2, 100)).toBe(true);
  expect(limiter.allow('a', 2, 100)).toBe(false);
  expect(limiter.allow('b', 2, 100)).toBe(false);
  now = 100;
  expect(limiter.allow('b', 2, 100)).toBe(true);
  limiter.clear();
  expect(limiter.allow('c', 2, 100)).toBe(true);
});

test('renaming preserves identity and expiry and cannot revive an expired session', () => {
  let now = 0;
  const sessions = createSessions(() => now, 1, 100);
  const original = sessions.issue('Ana');
  expect(sessions.rename(original.token, 'Bia')).toEqual({ ...original.session, nickname: 'Bia' });
  expect(sessions.find(original.token)?.nickname).toBe('Bia');
  expect(sessions.rename('unknown', 'Bia')).toBeUndefined();
  now = 100;
  expect(sessions.rename(original.token, 'Caio')).toBeUndefined();
  expect(sessions.find(original.token)).toBeUndefined();
});
