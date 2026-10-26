import { afterEach, expect, test } from 'bun:test';
import { HttpError } from '../../../shared/transport/client';
import { playerApi, playerError } from '../services/player-api';
import { catalog, mockFetch, profile, response } from './player-fixture.test';

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});

test('player API validates every response and sends only requested cosmetics with credentials', async () => {
  const calls: Array<{ path: string; init: RequestInit | undefined }> = [];
  globalThis.fetch = mockFetch(async (input, init) => {
    const path = String(input);
    calls.push({ path, init });
    return path.includes('/logout')
      ? new Response(null, { status: 204 })
      : response(
          path.includes('/catalog')
            ? catalog
            : path.includes('/ranking')
              ? { entries: [], nextPage: null }
              : path.includes('/recovery-code') || path.includes('/recover')
                ? { recoveryCode: 'a'.repeat(64) }
                : path.includes('/login') || path.includes('/register')
                  ? { nickname: 'Ana' }
                  : path.includes('/password') || path.includes('/delete')
                    ? {}
                    : profile,
        );
  });
  expect(await playerApi.profile()).toEqual(profile);
  expect(await playerApi.catalog()).toEqual(catalog);
  expect(await playerApi.ranking(2)).toEqual({ entries: [], nextPage: null });
  await playerApi.authenticate('register', { login: 'ana', password: 'secret', nickname: 'Ana' });
  await playerApi.authenticate('login', { login: 'ana', password: 'secret' });
  const selection = { avatarId: 'avatar-1', deckThemeId: 'ember', tableThemeId: 'classic' };
  await playerApi.select(selection);
  expect(
    JSON.parse(String(calls.find((call) => call.path.includes('/cosmetics'))?.init?.body)),
  ).toEqual(selection);
  await playerApi.rename('Ana');
  await playerApi.recovery('recovery-code', { password: 'secret' });
  await playerApi.recovery('recover', {});
  await playerApi.maintain('password', {});
  await playerApi.maintain('delete', {});
  await playerApi.logout();
  expect(calls.every((call) => call.init?.credentials === 'include')).toBe(true);
  globalThis.fetch = mockFetch(async () => response({ ...profile, level: '0' }));
  await expect(playerApi.profile()).rejects.toThrow();
  globalThis.fetch = mockFetch(async () =>
    response({
      ...catalog,
      avatars: [{ ...catalog.avatars[0], avatarUrl: 'https://evil.test/track' }],
    }),
  );
  await expect(playerApi.catalog()).rejects.toThrow();
});

test('operational errors never echo backend details or credentials', () => {
  for (const [code, status, text] of [
    ['INVALID_CREDENTIALS', 401, 'Login ou senha'],
    ['INVALID_PASSWORD', 400, 'mais segura'],
    ['REGISTRATION_FAILED', 400, 'criar a conta'],
    ['AUTH_RATE_LIMITED', 429, 'Muitas tentativas'],
    ['UNAUTHENTICATED', 401, 'sessão terminou'],
    ['COSMETIC_LOCKED', 409, 'bloqueado'],
    ['INVALID_INPUT', 400, 'Confira'],
    ['UNAVAILABLE', 503, 'ocupado'],
    ['UNKNOWN', 500, 'carregar os dados'],
  ] as const)
    expect(playerError(new HttpError('safe', code, status))).toContain(text);
  expect(playerError(new Error('database password'))).not.toContain('database');
});
