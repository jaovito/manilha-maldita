import { expect, test } from '@playwright/test';

test('the production HTML shell is served in a browser', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Truco Caótico');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.locator('#root')).toHaveCount(1);
  expect(errors).toEqual([]);
});
