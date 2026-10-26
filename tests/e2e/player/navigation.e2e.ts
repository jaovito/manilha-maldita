import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';

test('browser Back and Forward restore internal menu screens instead of leaving the game', async ({
  page,
}) => {
  await page.goto('/');
  await enterNickname(page, 'Browser Navigation');
  const origin = new URL(page.url()).origin;
  for (const [button, hash] of [
    ['Entrar em sala', 'join'],
    ['Como jogar', 'tutorial'],
    ['Configurações', 'settings'],
    ['Cosméticos', 'cosmetics'],
    ['Ranking global', 'ranking'],
    ['Entrar na conta', 'account'],
  ]) {
    await page.getByRole('button', { name: new RegExp(`^(?:✦ )?${button}(?: ✦)?$`) }).click();
    await expect(page).toHaveURL(`${origin}/#${hash}`);
    await page.goBack();
    await expect(page).toHaveURL(`${origin}/`);
    await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(`${origin}/#${hash}`);
    await page.goBack();
    await expect(page).toHaveURL(`${origin}/`);
  }
  await page.getByRole('button', { name: /Cosméticos/ }).click();
  await page.getByRole('button', { name: 'Voltar ao menu', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/`);
  await page.goForward();
  await expect(page.getByRole('dialog', { name: 'Personalização' })).toBeVisible();
});

test('Back from Jogar returns to the menu and Forward reconnects the existing bot match', async ({
  page,
}) => {
  await page.goto('/');
  await enterNickname(page, 'Back From Play');
  const origin = new URL(page.url()).origin;
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await expect(page.locator('.game-table')).toBeVisible();
  const invitation = page.url();
  expect(new URL(invitation).searchParams.get('room')).toMatch(/^[A-Z0-9]{6}$/);
  await page.goBack();
  await expect(page).toHaveURL(`${origin}/`);
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  await expect(page.locator('.game-table')).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(invitation);
  await expect(page.locator('.game-table')).toBeVisible();
  await expect(page.locator('.room-stage')).not.toHaveClass(/disconnected/);
  await expect(page.locator('[aria-label="Resultado da partida"]')).toHaveCount(0);

  await page.locator('.room-menu > summary').click();
  await page.getByRole('button', { name: 'Sair da partida', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar desistência' }).click();
  await expect(page.locator('[aria-label="Resultado da partida"]')).toBeVisible();
  await page.getByRole('button', { name: 'Sair da sala', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/`);
});

test('Back cancels a pending entry and its late error cannot replace a newer room', async ({
  page,
}) => {
  await page.goto('/');
  await enterNickname(page, 'Pending Navigation');
  let release = () => {};
  let received = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    received = resolve;
  });
  await page.route('**/api/rooms/ABC123/join', async (route) => {
    const response = await route.fetch();
    received();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.getByRole('button', { name: 'Entrar em sala', exact: true }).click();
    await page.getByLabel('Código da sala').fill('ABC123');
    const delayed = page.waitForResponse((response) =>
      response.url().endsWith('/api/rooms/ABC123/join'),
    );
    await page.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
    await started;
    await page.goBack();
    await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar sala', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
    await expect(page.getByLabel('Link de convite')).toBeVisible();
    const invitation = page.url();
    release();
    await delayed;
    await expect(page).toHaveURL(invitation);
    await expect(page.locator('.error-banner')).toHaveCount(0);
    await page.getByRole('button', { name: 'Sair da sala', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  } finally {
    release();
  }
});
