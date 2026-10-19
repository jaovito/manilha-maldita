import { devices, expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';
import { assertNoOverflow } from '../support/viewport';

test('first access validates a nickname and confirms only a local preference', async ({ page }) => {
  let identitiesCreated = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/guest')
      identitiesCreated++;
  });
  await page.goto('/');
  const nickname = page.getByLabel('Apelido');
  const next = page.getByRole('button', { name: 'Continuar', exact: true });
  await expect(next).toBeDisabled();
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toHaveCount(0);
  await assertNoOverflow(page);
  await nickname.fill('Ainda não confirmado');
  await page.reload();
  await expect(nickname).toHaveValue('');
  await nickname.fill('   ');
  await expect(next).toBeDisabled();
  await nickname.fill('Nome inválido!');
  await expect(next).toBeDisabled();
  await enterNickname(page, '  Visitante válido  ');
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  await expect(nickname).toHaveValue('Visitante válido');
  expect(identitiesCreated).toBe(0);
  expect((await page.request.get('/api/guest')).status()).toBe(401);
  expect(await page.evaluate<string | null>('localStorage.getItem("truco.nickname")')).toBe(
    'Visitante válido',
  );

  await page.reload();
  await expect(next).toHaveCount(0);
  await expect(nickname).toHaveValue('Visitante válido');
  await nickname.fill('');
  await expect(next).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Criar sala', exact: true })).toBeDisabled();
  await nickname.fill('Nome alterado');
  await expect(next).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Criar sala', exact: true })).toBeEnabled();
});

test('a valid guest cookie restores the nickname without repeating first access', async ({
  page,
}) => {
  await page.goto('/');
  await enterNickname(page, 'Convidado restaurado');
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Sala / })).toBeVisible();
  await page.getByRole('button', { name: 'Sair da sala', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  await page.evaluate('localStorage.removeItem("truco.nickname")');
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Apelido')).toHaveValue('Convidado restaurado');
});

test('an invitation survives first access and joining still requires an explicit action', async ({
  page,
  browser,
}, info) => {
  await page.goto('/');
  await enterNickname(page, 'Anfitrião do convite');
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Sala / })).toBeVisible();
  const invitation = await page.getByLabel('Link de convite').inputValue();
  const code = new URL(invitation).searchParams.get('room');
  const context = await browser.newContext(
    info.project.name === 'mobile-chromium' ? devices['Pixel 7'] : devices['Desktop Chrome'],
  );
  try {
    const guest = await context.newPage();
    let identitiesCreated = 0;
    guest.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/guest')
        identitiesCreated++;
    });
    await guest.goto(invitation);
    await expect(guest.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
    await expect(guest.getByLabel('Código da sala')).toHaveCount(0);
    await enterNickname(guest, 'Amigo convidado');
    await expect(guest.getByLabel('Código da sala')).toHaveValue(code ?? '');
    await expect(guest.getByRole('button', { name: 'Entrar na sala', exact: true })).toBeEnabled();
    expect(identitiesCreated).toBe(0);
    await guest.reload();
    await expect(guest.getByRole('button', { name: 'Continuar', exact: true })).toHaveCount(0);
    await expect(guest.getByLabel('Código da sala')).toHaveValue(code ?? '');
    await guest.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
    await expect(guest.getByRole('heading', { name: `Sala ${code}` })).toBeVisible();
    expect(identitiesCreated).toBe(1);
    await expect(
      page.getByText('Amigo convidado · conectado · aguardando', { exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
