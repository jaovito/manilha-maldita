import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';

test('optional account, separate cosmetic tabs, server locks and persistent login', async ({
  page,
}) => {
  const login = `browser_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const password = 'TruC06';
  await page.goto('/');
  await enterNickname(page, 'Browser Ana');
  await page.getByRole('button', { name: /Cosméticos/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Baralhos' }).click();
  await dialog.getByRole('button', { name: /Brasa/ }).click();
  await dialog.getByRole('button', { name: 'Entre para equipar' }).click();
  await dialog.getByRole('button', { name: 'Voltar à personalização' }).click();
  await expect(dialog.getByRole('tab', { name: 'Baralhos' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(dialog.getByRole('button', { name: /Brasa/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByRole('button', { name: 'Entre para equipar' }).click();
  await dialog.getByRole('button', { name: 'Criar conta', exact: true }).first().click();
  await dialog.getByRole('button', { name: 'Criar conta', exact: true }).last().click();
  await expect(dialog.getByRole('alert')).toContainText('Informe um usuário');
  await dialog.getByLabel('Usuário', { exact: false }).fill(login);
  await dialog.getByLabel('Apelido', { exact: true }).fill('Browser Ana');
  await dialog.getByLabel('Senha', { exact: true }).first().fill('short');
  await dialog.getByRole('button', { name: 'Criar conta', exact: true }).last().click();
  await expect(dialog.getByRole('alert')).toContainText('6 a 128');
  await dialog.getByLabel('Senha', { exact: true }).first().fill(password);
  await dialog.getByLabel('Confirmar senha', { exact: true }).fill(password);
  const passwordInput = dialog.getByLabel('Senha', { exact: true }).first();
  await expect(passwordInput).toHaveAttribute('type', 'password');
  const showPassword = dialog.getByRole('button', { name: 'Mostrar senha: Senha', exact: true });
  await showPassword.focus();
  await page.keyboard.press('Enter');
  await expect(passwordInput).toHaveAttribute('type', 'text');
  await expect(passwordInput).toHaveValue(password);
  await expect(dialog.getByLabel('Confirmar senha', { exact: true })).toHaveAttribute(
    'type',
    'password',
  );
  await dialog.getByRole('button', { name: 'Ocultar senha: Senha', exact: true }).click();
  await expect(passwordInput).toHaveAttribute('type', 'password');

  await dialog.getByRole('button', { name: 'Criar conta', exact: true }).last().click();
  await expect(dialog.getByRole('tab', { name: 'Baralhos' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(dialog.getByRole('button', { name: /Brasa/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(dialog.getByRole('button', { name: 'Equipar', exact: true })).toBeDisabled();
  const forged = await page.request.post('/api/accounts/cosmetics', {
    data: { avatarId: null, deckThemeId: 'ember', tableThemeId: null },
    headers: { Origin: 'http://127.0.0.1:4173' },
  });
  expect(forged.status()).toBe(400);
  expect(await forged.json()).toEqual({ code: 'COSMETIC_LOCKED' });
  await dialog.getByRole('tab', { name: 'Mesas' }).click();
  await expect(dialog.locator('.cosmetic-table')).toHaveCount(4);
  await dialog.getByRole('button', { name: 'Voltar ao menu' }).click();
  await page.getByRole('button', { name: 'Ranking global' }).click();
  await expect(dialog.getByRole('heading', { name: 'Ranking global', level: 2 })).toBeVisible();
  await dialog.getByRole('button', { name: 'Voltar ao menu' }).click();
  await page.reload();
  const bounds = await page.locator('.account-profile').boundingBox();
  if (!bounds) throw new Error('MISSING_PROFILE');
  for (const button of await page.locator('.account-profile .profile-economy button').all()) {
    const control = await button.boundingBox();
    if (!control) throw new Error('MISSING_PROFILE_ACTION');
    expect(control.y).toBeGreaterThanOrEqual(bounds.y);
    expect(control.y + control.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  }
  await page.getByRole('button', { name: 'Minha conta' }).click();
  await expect(dialog.getByText('Browser Ana', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Sair da conta', exact: true }).click();
  await expect(dialog.getByLabel('Usuário', { exact: false })).toBeVisible();
  await dialog.getByLabel('Usuário', { exact: false }).fill(login);
  await dialog.getByLabel('Senha', { exact: true }).fill('Incorrect password for regression 123!');
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).last().click();
  await expect(dialog.locator('form').getByRole('alert')).toHaveText('Login ou senha inválidos.');
  await expect(dialog.getByRole('alert')).toBeFocused();
  await dialog.getByLabel('Senha', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).last().click();
  await expect(dialog.getByRole('button', { name: 'Salvar apelido' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Excluir conta', exact: true }).first().click();
  await dialog.getByLabel('Senha atual', { exact: true }).fill(password);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Excluir conta', exact: true }).last().click();
  await expect(dialog.getByLabel('Usuário', { exact: false })).toBeVisible();
});
