import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';

test('lobby fits desktop with editable settings and retains mobile scrolling', async ({ page }) => {
  await page.goto('/');
  await enterNickname(page, 'Anfitrião');
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await page.evaluate('document.fonts.ready');
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.getByText('Convide seus amigos para entrar na sala!')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copiar link da sala' })).toBeVisible();

  for (const format of ['1v1', '2v2']) {
    await page.getByRole('radio', { name: format, exact: true }).click();
    await expect(page.getByRole('radio', { name: format, exact: true })).toBeChecked();
    await expect(page.locator('.lobby-seat')).toHaveCount(format === '1v1' ? 2 : 4);
    for (const viewport of [
      { width: 1280, height: 640 },
      { width: 1280, height: 720 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport);
      for (const expanded of [false, true]) {
        if (expanded) await page.getByText('Ajustes de tempo', { exact: true }).click();
        await expect
          .poll(() =>
            page.evaluate(
              '({ x: document.documentElement.scrollWidth, y: document.documentElement.scrollHeight })',
            ),
          )
          .toEqual({ x: viewport.width, y: viewport.height });
        await expect(page.getByRole('button', { name: 'Iniciar partida' })).toBeInViewport();
        if (expanded) await page.getByText('Ajustes de tempo', { exact: true }).click();
      }
      await page.getByText('Ver poderes', { exact: true }).click();
      await expect(page.getByText(/Espião · 1 energia/)).toBeVisible();
      expect(await page.evaluate('document.documentElement.scrollHeight <= innerHeight')).toBe(
        true,
      );
      await page.getByText('Ver poderes', { exact: true }).click();
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
  await page.getByRole('button', { name: 'Estou pronto', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancelar pronto' })).toBeVisible();
  await page.getByRole('button', { name: 'Sair da sala' }).click();
  await expect(page.getByRole('button', { name: 'Criar sala', exact: true })).toBeVisible();
});
