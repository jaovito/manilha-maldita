import { expect, test } from '@playwright/test';

test('nickname survives reload before joining and remains a preference after the cookie is lost', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByLabel('Apelido').fill('João local');
  await page.reload();
  await expect(page.getByLabel('Apelido')).toHaveValue('João local');
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Sala / })).toBeVisible();

  await context.clearCookies();
  await page.goto('/');
  await expect(page.getByLabel('Apelido')).toHaveValue('João local');
  const guest = await page.request.get('/api/guest');
  expect(guest.status()).toBe(401);
  expect(await page.evaluate<string>('JSON.stringify({ ...localStorage })')).toBe(
    JSON.stringify({ 'truco.nickname': 'João local' }),
  );

  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(
    page.getByText('João local · conectado · aguardando', { exact: true }),
  ).toBeVisible();
});
