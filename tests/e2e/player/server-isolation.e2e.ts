import { enterNickname } from '../support/entry-flow';
import { expect, test } from '../support/player-test';

test('the real backend still enforces the default per-IP request budget', async ({ request }) => {
  for (let index = 0; index < 120; index++) {
    const response = await request.get('/api/features');
    expect(response.status()).toBe(200);
  }

  const denied = await request.get('/api/features');
  expect(denied.status()).toBe(429);
  expect(await denied.json()).toEqual({ code: 'RATE_LIMITED' });
});

test('a later scenario gets independent admission and can create and leave a real room', async ({
  page,
}) => {
  await page.goto('/');
  await enterNickname(page, 'Independent Admission');
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(page.getByLabel('Link de convite')).toBeVisible();
  await expect(page.locator('.error-banner')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sair da sala', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
});
