import { afterEach, expect, mock, test } from 'bun:test';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NICKNAME_KEY, saveNickname } from '../../shared/preferences/nickname';
import { App } from './index';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  location.href = 'http://localhost/';
});

function respond(response: Response | Promise<Response>) {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: mock(async () => response),
  });
}

test('confirming the first nickname remembers it across mounts and clearing the profile removes it', () => {
  respond(new Response('{}', { status: 401 }));
  const first = render(<App />);
  fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: 'Beto' } });
  expect(localStorage.getItem(NICKNAME_KEY)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(localStorage.getItem(NICKNAME_KEY)).toBe('Beto');
  first.unmount();

  const second = render(<App />);
  expect(screen.getByRole('navigation', { name: 'Menu principal' })).toBeDefined();
  expect(screen.getByLabelText<HTMLInputElement>('Apelido').value).toBe('Beto');
  fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: '' } });
  expect(screen.queryByRole('region', { name: 'Boas-vindas' })).toBeNull();
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
  expect(screen.queryByRole('region', { name: 'Boas-vindas' })).toBeNull();
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
  expect(localStorage.getItem(NICKNAME_KEY)).toBeNull();
  expect(screen.getByRole('region', { name: 'Boas-vindas' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
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

test('first access preserves the invitation and confirms a trimmed nickname without creating a session', async () => {
  location.href = 'http://localhost/?room=ABC123';
  const fetcher = mock(async () => new Response('{}', { status: 401 }));
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: fetcher,
  });
  render(<App />);
  expect(screen.queryByRole('navigation', { name: 'Menu principal' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Criar sala' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: '  João  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(screen.queryByRole('region', { name: 'Boas-vindas' })).toBeNull();
  expect(screen.getByLabelText<HTMLInputElement>('Código da sala').value).toBe('ABC123');
  expect(screen.getByLabelText<HTMLInputElement>('Apelido').value).toBe('João');
  expect(localStorage.getItem(NICKNAME_KEY)).toBe('João');
  await act(async () => {});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(location.search).toBe('?room=ABC123');
});

test('a late cookie response never joins an invitation after the player begins choosing a nickname', async () => {
  location.href = 'http://localhost/?room=ABC123';
  let resolveGuest: (response: Response) => void = () => {};
  const fetcher = mock(
    () =>
      new Promise<Response>((resolve) => {
        resolveGuest = resolve;
      }),
  );
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: fetcher,
  });
  render(<App />);
  fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: 'Novo' } });
  await act(async () => resolveGuest(new Response(JSON.stringify({ nickname: 'Antigo' }))));
  expect(screen.getByRole('region', { name: 'Boas-vindas' })).toBeDefined();
  expect(screen.getByLabelText<HTMLInputElement>('Apelido').value).toBe('Novo');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('choosing a nickname still reaches the menu when browser storage is blocked', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  respond(new Response('{}', { status: 401 }));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Storage blocked');
    },
  });

  try {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('navigation', { name: 'Menu principal' })).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>('Apelido').value).toBe('Ana');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
