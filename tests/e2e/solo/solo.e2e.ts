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
