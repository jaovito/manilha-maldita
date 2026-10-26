import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';

const password = 'TruC06';

test('login rejects invalid credentials visibly, persists after reload and logout revokes access', async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error('MISSING_BROWSER_BASE_URL');

  const origin = new URL(baseURL).origin;
  const login = `browser_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const registered = await page.request.post('/api/accounts/register', {
    data: { login, password, nickname: 'Login Player' },
    headers: { Origin: origin },
  });
  expect(registered.status()).toBe(201);

  try {
    expect(
      (
        await page.request.post('/api/accounts/logout', { data: {}, headers: { Origin: origin } })
      ).status(),
    ).toBe(204);
    await page.goto('/');
    await enterNickname(page, 'Guest Player');
    await page.getByRole('button', { name: 'Entrar na conta', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).last().click();
    await expect(dialog.getByRole('alert')).toContainText('Informe um usuário');
    await dialog.getByLabel('Usuário', { exact: false }).fill(login);
    await dialog
      .getByLabel('Senha', { exact: true })
      .fill('Incorrect password for regression 123!');
    const rejected = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/accounts/login') && response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).last().click();
    expect((await rejected).status()).toBe(401);
    await expect(dialog.locator('form').getByRole('alert')).toHaveText('Login ou senha inválidos.');
    await expect(dialog.getByRole('alert')).toBeFocused();
    expect((await page.request.get('/api/accounts/progression')).status()).toBe(401);
    await dialog.getByLabel('Senha', { exact: true }).fill(password);
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).last().click();
    await expect(dialog.getByRole('button', { name: 'Salvar apelido' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Voltar ao menu' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Minha conta' })).toBeVisible();
    await expect(page.getByLabel('Apelido', { exact: true })).toHaveValue('Login Player');
    await page.getByRole('button', { name: 'Minha conta' }).click();
    await dialog.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await expect(dialog.getByLabel('Usuário', { exact: false })).toBeVisible();
    expect((await page.request.get('/api/accounts/progression')).status()).toBe(401);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Entrar na conta', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Minha conta' })).toHaveCount(0);
  } finally {
    const authenticated = await page.request.post('/api/accounts/login', {
      data: { login, password },
      headers: { Origin: origin },
    });
    expect(authenticated.status()).toBe(200);
    const deleted = await page.request.post('/api/accounts/delete', {
      data: { password },
      headers: { Origin: origin },
    });
    expect(deleted.status()).toBe(200);
  }
});
