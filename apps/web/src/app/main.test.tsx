import { expect, test } from 'bun:test';
import { act, screen } from '@testing-library/react';

test('browser entry mounts the guest screen into the document root', async () => {
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: async () => new Response('{}'),
  });
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
  await act(async () => {
    await import('./main');
  });
  expect(screen.getByRole('heading', { name: 'Truco Caótico', level: 1 })).toBeDefined();
  expect(screen.getByRole('navigation', { name: 'Menu principal' })).toBeDefined();
  expect(screen.getByRole('region', { name: 'Seu perfil' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Criar sala' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Entrar em sala' })).toBeDefined();
  expect(screen.getByLabelText('Apelido')).toBeDefined();
  expect(screen.queryByLabelText('Código da sala')).toBeNull();
  const { application } = await import('./main');
  act(() => application?.unmount());
  root.remove();
  globalThis.fetch = originalFetch;
});
