import { afterEach, expect, test } from 'bun:test';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePlayer } from '../hooks/use-player';
import { mockFetch, profile, response } from './player-fixture.test';

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});

test('account lifecycle uses confirmed server data and keeps credentials out of storage', async () => {
  globalThis.fetch = mockFetch(async (input) => {
    const path = String(input);
    return path.includes('/logout')
      ? new Response(null, { status: 204 })
      : response(
          path.includes('/recovery-code') || path.includes('/recover')
            ? { recoveryCode: 'a'.repeat(64) }
            : path.includes('/register') || path.includes('/login')
              ? { nickname: 'Ana' }
              : profile,
        );
  });
  const { result } = renderHook(() => usePlayer(true));
  await waitFor(() => expect(result.current.profile).toEqual(profile));
  await act(() => result.current.authenticate('login', {}));
  await act(() => result.current.rename('Ana'));
  await act(() =>
    result.current.select({
      avatarId: 'avatar-1',
      deckThemeId: 'classic',
      tableThemeId: 'classic',
    }),
  );
  await act(async () =>
    expect(await result.current.recovery('recovery-code', {})).toBe('a'.repeat(64)),
  );
  await act(() => result.current.recovery('recover', {}));
  expect(result.current.profile).toBeNull();
  await act(() => result.current.authenticate('register', {}));
  await act(() => result.current.maintain('password', {}));
  expect(result.current.profile).toBeNull();
  await act(() => result.current.refresh());
  await act(() => result.current.maintain('delete', {}));
  await act(() => result.current.refresh());
  await act(() => result.current.logout());
  expect(result.current.profile).toBeNull();
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(result.current.profile).toEqual(profile));
});

test('wrong reauthentication password retains the session; expired sessions clear it', async () => {
  globalThis.fetch = mockFetch(async () => response(profile));
  const { result } = renderHook(() => usePlayer(true));
  await waitFor(() => expect(result.current.profile).toEqual(profile));
  globalThis.fetch = mockFetch(async () => response({ code: 'INVALID_CREDENTIALS' }, 401));
  await act(async () => {
    try {
      await result.current.maintain('password', {});
    } catch {}
  });
  expect(result.current.profile).toEqual(profile);
  expect(result.current.error).toContain('Login ou senha');
  act(() => result.current.clearError());
  expect(result.current.error).toBe('');
  globalThis.fetch = mockFetch(async () => response({ code: 'UNAUTHENTICATED' }, 401));
  await act(async () => {
    try {
      await result.current.rename('Ana');
    } catch {}
  });
  expect(result.current.profile).toBeNull();
  await act(() => result.current.refresh());
  expect(result.current.error).toBe('');
  globalThis.fetch = mockFetch(async () => response({ error: 'UNAVAILABLE' }, 503));
  await act(() => result.current.refresh());
  expect(result.current.error).toContain('ocupado');
});

test('a delayed refresh cannot resurrect a logged out account; parallel mutations reject', async () => {
  let resolve: (value: Response) => void = () => {};
  globalThis.fetch = mockFetch((input) =>
    String(input).includes('/logout')
      ? Promise.resolve(new Response(null, { status: 204 }))
      : new Promise<Response>((done) => {
          resolve = done;
        }),
  );
  const { result, unmount } = renderHook(() => usePlayer(true));
  await act(() => result.current.logout());
  await act(async () => resolve(response(profile)));
  expect(result.current.profile).toBeNull();
  let task: Promise<void> = Promise.resolve();
  act(() => {
    task = result.current.authenticate('login', {});
  });
  await act(async () => {
    await expect(result.current.rename('Other')).rejects.toThrow('PLAYER_OPERATION_PENDING');
  });
  unmount();
  resolve(response({ nickname: 'Ana' }));
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(4));
  resolve(response(profile));
  await task;
  const disabled = renderHook(() => usePlayer(false));
  await act(() => disabled.result.current.refresh());
  expect(disabled.result.current.profile).toBeNull();
});
