import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';

test('nickname survives reload before joining and remains a preference after the cookie is lost', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await enterNickname(page, 'João local');
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

test('editing the current nickname through the profile shows the updated name in a newly created room', async ({
  page,
}) => {
  await page.goto('/');
  await enterNickname(page, 'Anterior');
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(page.getByText('Anterior · conectado · aguardando', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sair da sala', exact: true }).click();
  const nickname = page.getByRole('textbox', { name: /Apelido/ });
  await expect(nickname).toHaveValue('Anterior');
  await page.getByRole('button', { name: 'Editar nome', exact: true }).click();
  await expect(nickname).toBeFocused();
  await nickname.fill('Novo nome');
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Sala / })).toBeVisible();
  await expect(page.getByText('Novo nome · conectado · aguardando', { exact: true })).toBeVisible();
  await expect(page.getByText('Anterior · conectado · aguardando', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Novo nome · conectado · aguardando', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sair da sala', exact: true }).click();
  await expect(page.getByLabel('Apelido')).toHaveValue('Novo nome');
});
