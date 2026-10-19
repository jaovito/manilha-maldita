import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';

test('global settings translate the menu, lobby, errors and tutorial and survive reload', async ({
  page,
}) => {
  await page.goto('/');
  await enterNickname(page, 'Espião');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('combobox', { name: 'Idioma do jogo', exact: true }).selectOption('en');
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(settings.getByText('Sound', { exact: true })).toBeVisible();
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await expect(page.getByLabel('Nickname', { exact: true })).toHaveValue('Espião');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Create room', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await page.getByLabel('Room code', { exact: true }).fill('ZZZZZZ');
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Room not found');
  await page.getByRole('button', { name: '← Back to menu', exact: true }).click();
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByText('Room players', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: "I'm ready", exact: true })).toBeVisible();
  await expect(page.getByLabel('Format', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Game language', exact: true }).selectOption('pt-BR');
  await page
    .getByRole('dialog', { name: 'Configurações', exact: true })
    .getByRole('button', { name: 'Voltar', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Estou pronto', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sair da sala', exact: true }).click();
  await page.getByRole('button', { name: '← Voltar ao menu', exact: true }).click();
  await page.mouse.move(0, 0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Como jogar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Idioma do jogo', exact: true }).selectOption('en');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Create room', exact: true })).toBeVisible();
});

test('language changes during a real solo match preserve its state and translate cards and results', async ({
  page,
}) => {
  const sent: string[] = [];
  page.on('websocket', (socket) =>
    socket.on('framesent', (event) => sent.push(String(event.payload))),
  );
  await page.goto('/');
  await enterNickname(page, 'Paus');
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await expect(page.locator('.game-table')).toBeVisible();
  await page.locator('.room-menu > summary').click();
  await page.getByText('Ferramentas de desenvolvimento', { exact: true }).click();
  await page.getByLabel('Carta 1', { exact: true }).selectOption('3:clubs');
  const roomUrl = page.url();
  const before = sent.length;
  await page.getByRole('combobox', { name: 'Idioma do jogo', exact: true }).selectOption('en');
  await expect(page.getByLabel('Card 1', { exact: true })).toHaveValue('3:clubs');
  await expect(page.getByText('Development tools', { exact: true })).toBeVisible();
  expect(sent.length).toBe(before);
  expect(page.url()).toBe(roomUrl);
  await page.getByRole('button', { name: 'Close room menu', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your hand', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Powers and energy', exact: true })).toBeVisible();
  await page.locator('.room-menu > summary').click();
  await page.getByRole('button', { name: 'Leave match', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm surrender', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Match results', exact: true })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: 'Rematch', exact: true })).toBeVisible();
  await expect(page.getByText('YOU LOST', { exact: true })).toBeVisible();
});
