import { expect, test } from 'bun:test';
import { createSessions } from './index';

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
