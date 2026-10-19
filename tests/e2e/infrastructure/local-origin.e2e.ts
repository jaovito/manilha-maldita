import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';
import { assertLobbyContrast } from '../support/lobby-contrast';

test('localhost creates a guest, creates a room and connects its lobby socket', async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error('MISSING_BASE_URL');
  const address = new URL(baseURL);
  address.hostname = 'localhost';

  await page.goto(address.href);
  await enterNickname(page, 'Convidado local');
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();

  await expect(page.getByRole('heading', { name: /^Sala / })).toBeVisible();
  await expect(
    page.getByRole('status', { name: '' }).filter({ hasText: /^Conectado$/ }),
  ).toBeVisible();
  await expect(
    page.getByText('Convidado local · conectado · aguardando', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await assertLobbyContrast(page);
  await page.screenshot({
    path: `/tmp/truco-lobby-initial-${test.info().project.name}.png`,
    fullPage: true,
  });

  const original = page.viewportSize();
  if (test.info().project.name === 'chromium' && original) {
    await page.setViewportSize({ width: 1567, height: 882 });
    await assertLobbyContrast(page);
    await page.screenshot({ path: '/tmp/truco-lobby-reference-1567.png', fullPage: true });
    await page.setViewportSize(original);
  }

  await expect(page.getByRole('switch', { name: 'Sala privada' })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Poderes aleatórios' })).toHaveCount(0);
  await page.getByRole('radio', { name: '1v1', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: '2v2', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Sentar no assento 4' })).toBeVisible();
  await page.getByRole('radio', { name: 'Competitivo', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Competitivo', exact: true })).toBeChecked();
  await page.getByText('Ajustes de tempo', { exact: true }).click();
  await expect(page.locator('.clock-summary')).toHaveText(
    'Carta: 20 segundos · Resposta: 15 segundos · Preparação: 10 segundos',
  );
});
