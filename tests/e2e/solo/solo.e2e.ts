import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';

// This suite uses the explicit development server with independently enabled solo/dev flags.
test('Jogar starts a bot match and the development menu applies each power with a custom hand', async ({
  page,
}) => {
  await page.goto('/');
  await enterNickname(page, 'Treinador');
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await expect(page.locator('.game-table')).toBeVisible();
  await expect(page.locator('.game-table')).toContainText('Bot Treino');
  await page.locator('.room-menu > summary').click();
  await page.getByText('Ferramentas de desenvolvimento', { exact: true }).click();
  for (const power of ['spy', 'exchange', 'boost', 'mask']) {
    await page.getByLabel('Carta 1', { exact: true }).selectOption('3:clubs');
    await page.getByLabel('Carta 2', { exact: true }).selectOption('A:hearts');
    await page.getByLabel('Carta 3', { exact: true }).selectOption('4:spades');
    await page.getByLabel('Poder de teste').selectOption(power);
    await page.getByLabel('Energia de teste').selectOption('3');
    const previous = await page.locator('[data-sequence]').getAttribute('data-sequence');
    await page.getByRole('button', { name: 'Aplicar cenário e reiniciar mão' }).click();
    await expect(page.locator('[data-sequence]')).not.toHaveAttribute(
      'data-sequence',
      previous ?? '',
    );
    await expect(page.locator('.error-banner')).toHaveCount(0);
    await page.getByText('Ferramentas de desenvolvimento', { exact: true }).click();
    await expect(page.getByLabel('Carta 1', { exact: true })).toHaveValue('3:clubs');
  }
  await page.getByRole('button', { name: 'Fechar menu da sala' }).click();
  await page.getByRole('button', { name: 'Passar preparação' }).click();
  await expect(page.locator('.own-hand .card').first()).toBeVisible();
  // The real bot resolves preparation and takes its turn, without a second browser client.
  await expect(page.locator('.own-hand .card:not(:disabled)').first()).toBeEnabled({
    timeout: 10000,
  });
  await page.locator('.own-hand .card:not(:disabled)').first().click();
  await expect(page.locator('.error-banner')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.game-table')).toBeVisible();
  await page.locator('.room-menu > summary').click();
  await expect(page.getByText('Ferramentas de desenvolvimento', { exact: true })).toBeVisible();
});

test('Spy observation opens a proportional card preview and restores focus', async ({ page }) => {
  await page.goto('/');
  await enterNickname(page, 'Observador');
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await page.locator('.room-menu > summary').click();
  await page.getByText('Ferramentas de desenvolvimento', { exact: true }).click();
  await page.getByLabel('Poder de teste').selectOption('spy');
  await page.getByLabel('Energia de teste').selectOption('3');
  await page.getByRole('button', { name: 'Aplicar cenário e reiniciar mão' }).click();
  await page.getByRole('button', { name: 'Fechar menu da sala' }).click();
  const spy = page.getByRole('button', { name: 'Poder Espião', exact: true });
  await expect(spy).toHaveAttribute('data-can-activate', 'true');
  await spy.click();
  await page
    .getByRole('button', { name: /Espionar carta/ })
    .first()
    .click();
  const observation = page.getByRole('button', { name: /^Ampliar carta revelada:/ });
  await observation.click();
  const preview = page.getByRole('dialog', { name: 'Carta revelada pelo Espião' });
  await expect(preview).toBeVisible();
  const face = preview.locator('.spy-preview-face');
  const bounds = await face.boundingBox();
  if (!bounds) throw new Error('Spy preview card is not visible');
  expect(bounds.width / bounds.height).toBeCloseTo(2 / 3, 2);
  await expect(preview.getByRole('button', { name: 'Fechar carta' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(observation).toBeFocused();
  await observation.click();
  await preview.getByRole('button', { name: 'Fechar carta' }).click();
  await expect(preview).toHaveCount(0);
});
