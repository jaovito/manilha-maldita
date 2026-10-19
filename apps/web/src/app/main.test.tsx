import { expect, test } from 'bun:test';
import { act, fireEvent, screen } from '@testing-library/react';

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
  try {
    expect(screen.getByRole('region', { name: 'Boas-vindas' })).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Menu principal' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('heading', { name: 'Manilha Maldita', level: 1 })).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Menu principal' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Seu perfil' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Criar sala' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Entrar em sala' })).toBeDefined();
    expect(screen.getByLabelText('Apelido')).toBeDefined();
    expect(screen.queryByLabelText('Código da sala')).toBeNull();
  } finally {
    const { application } = await import('./main');
    act(() => application?.unmount());
    root.remove();
    globalThis.fetch = originalFetch;
  }
});
