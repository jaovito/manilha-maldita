import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';

test('production build allows solo but excludes the development panel even when the server advertises it', async ({
  page,
}) => {
  await page.goto('/');
  await enterNickname(page, 'Treino');
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await expect(page.locator('.game-table')).toContainText('Bot Treino');
  await page.locator('.room-menu > summary').click();
  await expect(page.getByText('Ferramentas de desenvolvimento', { exact: true })).toHaveCount(0);
  await expect(page.locator('.dev-tools')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sair da partida', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar desistência' }).click();
  await page.getByRole('button', { name: 'Revanche', exact: true }).click({ timeout: 12000 });
  await expect(page.locator('.game-table')).toBeVisible();
  await expect(page.locator('.stake-score')).toContainText('1');
});
