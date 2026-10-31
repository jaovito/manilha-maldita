import { expect, type Locator, test } from '@playwright/test';

test('account maintenance and one-time recovery revoke old credentials and preserve the profile', async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error('MISSING_BROWSER_BASE_URL');

  const origin = new URL(baseURL).origin;
  const login = `browser_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const passwords = [
    'TruC06',
    'River lanterns changed 742!',
    'Recovered copper lanterns 862!',
  ] as const;
  const headers = { Origin: origin };
  const registered = await page.request.post('/api/accounts/register', {
    headers,
    data: { login, password: passwords[0], nickname: 'Recovery Player' },
  });
  expect(registered.status()).toBe(201);

  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Minha conta', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Apelido', { exact: true }).fill('Recovered Player');
    await dialog.getByRole('button', { name: 'Salvar apelido', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('Apelido salvo.');

    await dialog.getByLabel('Senha atual', { exact: true }).fill(passwords[0]);
    await dialog.getByRole('button', { name: 'Gerar código de recuperação', exact: true }).click();
    const recovery = dialog
      .getByRole('region', { name: 'Código de recuperação' })
      .locator('output');
    await expect(recovery).toHaveText(/^[a-f0-9]{64}$/);
    const retiredCode = await recovery.innerText();

    await dialog.getByRole('button', { name: 'Alterar senha', exact: true }).click();
    await dialog.getByLabel('Senha atual', { exact: true }).fill(passwords[0]);
    await dialog.getByLabel('Nova senha', { exact: true }).fill(passwords[1]);
    await dialog.getByLabel('Confirmar senha', { exact: true }).fill(passwords[1]);
    await dialog.locator('button[type="submit"]').filter({ hasText: 'Alterar senha' }).click();
    await expect(dialog.getByLabel('Usuário', { exact: false })).toBeVisible();
    expect((await page.request.get('/api/accounts/progression')).status()).toBe(401);
    expect(
      (
        await page.request.post('/api/accounts/login', {
          headers,
          data: { login, password: passwords[0] },
        })
      ).status(),
    ).toBe(401);

    await dialog.getByLabel('Usuário', { exact: false }).fill(login);
    await dialog.getByLabel('Senha', { exact: true }).fill(passwords[1]);
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).last().click();
    await dialog.getByLabel('Senha atual', { exact: true }).fill(passwords[1]);
    await dialog.getByRole('button', { name: 'Gerar código de recuperação', exact: true }).click();
    await expect(recovery).toHaveText(/^[a-f0-9]{64}$/);
    const code = await recovery.innerText();
    expect(code).not.toBe(retiredCode);
    await dialog.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await dialog.getByRole('button', { name: 'Recuperar conta', exact: true }).click();
    await dialog.getByLabel('Usuário', { exact: false }).fill(login);
    await dialog.getByLabel('Código de recuperação', { exact: true }).fill(retiredCode);
    await fillRecovery(dialog, passwords[2]);
    await dialog.getByRole('button', { name: 'Recuperar acesso', exact: true }).click();
    await expect(dialog.locator('form').getByRole('alert')).toBeVisible();
    expect((await page.request.get('/api/accounts/progression')).status()).toBe(401);

    await dialog.getByLabel('Código de recuperação', { exact: true }).fill(code);
    await fillRecovery(dialog, passwords[2]);
    await dialog.getByRole('button', { name: 'Recuperar acesso', exact: true }).click();
    await expect(recovery).toHaveText(/^[a-f0-9]{64}$/);
    expect(await recovery.innerText()).not.toBe(code);
    expect((await page.request.get('/api/accounts/progression')).status()).toBe(401);

    // A successful recovery consumes the previous proof; replay cannot change the password.
    expect(
      (
        await page.request.post('/api/accounts/recover', {
          headers,
          data: { login, recoveryCode: code, newPassword: passwords[0] },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.post('/api/accounts/login', {
          headers,
          data: { login, password: passwords[1] },
        })
      ).status(),
    ).toBe(401);

    await dialog.getByLabel('Usuário', { exact: false }).fill(login);
    await dialog.getByLabel('Senha', { exact: true }).fill(passwords[2]);
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).last().click();
    await expect(dialog.getByLabel('Apelido', { exact: true })).toHaveValue('Recovered Player');
    await expect(recovery).toHaveCount(0);
    await page.reload();
    await expect(dialog.getByLabel('Apelido', { exact: true })).toHaveValue('Recovered Player');
    await dialog.getByRole('button', { name: 'Excluir conta', exact: true }).click();
    await dialog.getByLabel('Senha atual', { exact: true }).fill(passwords[2]);
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Excluir conta', exact: true }).last().click();
    await expect(dialog.getByLabel('Usuário', { exact: false })).toBeVisible();
    expect((await page.request.get('/api/accounts/progression')).status()).toBe(401);
  } finally {
    // Any completed credential transition can be the last one before a failed assertion.
    for (const password of passwords.toReversed()) {
      const authenticated = await page.request.post('/api/accounts/login', {
        headers,
        data: { login, password },
      });
      if (!authenticated.ok()) continue;

      const deleted = await page.request.post('/api/accounts/delete', {
        headers,
        data: { password },
      });
      expect(deleted.ok()).toBe(true);
      break;
    }
  }
});

async function fillRecovery(dialog: Locator, password: string) {
  await dialog.getByLabel('Nova senha', { exact: true }).fill(password);
  await dialog.getByLabel('Confirmar senha', { exact: true }).fill(password);
}
