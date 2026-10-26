import { expect, test } from 'bun:test';
import { act, screen } from '@testing-library/react';

test('independent font comparison entry mounts into its own root', async () => {
  const root = document.createElement('div');
  root.id = 'card-font-root';
  document.body.append(root);
  await act(async () => {
    await import('./card-fonts');
  });
  try {
    expect(
      screen.getByRole('heading', { level: 1, name: 'Qual fonte funciona melhor nas cartas?' }),
    ).toBeDefined();
  } finally {
    const { comparison } = await import('./card-fonts');
    act(() => comparison?.unmount());
    root.remove();
  }
});
