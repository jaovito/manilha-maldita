import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';

test('tutorial teaches with feedback, interactive vira and persistent English without creating a room', async ({
  page,
}) => {
  const roomRequests: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/rooms'))
      roomRequests.push(request.url());
  });
  await page.goto('/');
  await enterNickname(page, 'Aprendiz');
  // The pointer can land on a disabled menu item after the welcome screen closes.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Como jogar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Como jogar' })).toBeVisible();
  await page.getByRole('button', { name: '1 carta', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Vamos entender juntos.');
  await page.getByRole('button', { name: '3 cartas', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Acertou!');
  await page.getByRole('button', { name: /A vira muda tudo/ }).click();
  await page.getByLabel('Escolha a vira').selectOption('9');
  await expect(page.getByRole('img', { name: '4 Paus', exact: true })).toBeVisible();
  await page.getByLabel('Idioma do jogo').selectOption('en');
  await expect(page.getByRole('dialog')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('img', { name: '4 Clubs', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Four powers, new decisions/ }).click();
  for (const name of ['Spy', 'Second Chance', 'Boost', 'Mask']) {
    const heading = page.getByRole('heading', { name, exact: true });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
  }
  await page.getByRole('button', { name: /Your first match/ }).click();
  await page.getByRole('button', { name: /Finish tutorial/ }).click();
  await expect(page.getByRole('button', { name: 'How to play', exact: true })).toBeFocused();
  await page.reload();
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(roomRequests).toHaveLength(0);
});

test('all lessons and navigation fit narrow, wide and landscape screens', async ({ page }) => {
  await page.goto('/');
  await enterNickname(page, 'Aprendiz');
  // The pointer can land on a disabled menu item after the welcome screen closes.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Como jogar', exact: true }).click();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const language = page.getByLabel('Idioma do jogo');
    await expect(language).toHaveCSS('appearance', 'none');
    await expect(language).toHaveCSS('padding-right', '40px');
    await expect(language).toHaveCSS('background-position', 'calc(100% - 12px) 50%');
    for (const title of [
      'Conheça a força das cartas',
      'A vira muda tudo',
      'Quatro poderes, novas decisões',
    ]) {
      await page.getByRole('button', { name: new RegExp(title) }).click();
      await expect(page.getByRole('heading', { name: title, level: 2 })).toBeInViewport();
      await expect(page.getByRole('button', { name: /Voltar ao menu/ })).toBeInViewport();
      await expect(page.getByRole('button', { name: /Próxima etapa/ })).toBeInViewport();
      expect(
        await page
          .locator('.tutorial-page')
          .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
      expect(
        await page
          .locator('.tutorial-shell')
          .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
    }
  }
});
