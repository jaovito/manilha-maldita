import { afterEach, expect, mock, test } from 'bun:test';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NICKNAME_KEY, saveNickname } from '../../shared/preferences/nickname';
import { App } from './index';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function respond(response: Response | Promise<Response>) {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: mock(async () => response),
  });
}

test('editing remembers the nickname across mounts without a session and clearing removes it', () => {
  respond(new Response('{}', { status: 401 }));
  const first = render(<App />);
  fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: 'Beto' } });
  expect(localStorage.getItem(NICKNAME_KEY)).toBe('Beto');
  first.unmount();

  const second = render(<App />);
  expect(screen.getByLabelText<HTMLInputElement>('Apelido').value).toBe('Beto');
  fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: '' } });
  second.unmount();

  render(<App />);
  expect(screen.getByLabelText<HTMLInputElement>('Apelido').value).toBe('');
  expect(localStorage.getItem(NICKNAME_KEY)).toBeNull();
});

test('a valid cookie session supplies its confirmed nickname instead of a saved preference', async () => {
  saveNickname('Local');
  respond(new Response(JSON.stringify({ nickname: 'Servidor' })));
  render(<App />);

  await waitFor(() =>
    expect(screen.getByLabelText<HTMLInputElement>('Apelido').value).toBe('Servidor'),
  );
  expect(localStorage.getItem(NICKNAME_KEY)).toBe('Servidor');
});

test('a late session response does not overwrite an edit in progress', async () => {
  let resolveGuest: (response: Response) => void = () => {};
  respond(
    new Promise<Response>((resolve) => {
      resolveGuest = resolve;
    }),
  );
  render(<App />);
  fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: 'Novo apelido' } });

  await act(async () => resolveGuest(new Response(JSON.stringify({ nickname: 'Anterior' }))));
  expect(screen.getByLabelText<HTMLInputElement>('Apelido').value).toBe('Novo apelido');
  expect(localStorage.getItem(NICKNAME_KEY)).toBe('Novo apelido');
});

test('malformed session nicknames do not replace a valid local preference', async () => {
  saveNickname('Local');
  respond(new Response(JSON.stringify({ nickname: '<script>' })));
  render(<App />);

  await act(async () => {});
  expect(screen.getByLabelText<HTMLInputElement>('Apelido').value).toBe('Local');
  expect(localStorage.getItem(NICKNAME_KEY)).toBe('Local');
});
