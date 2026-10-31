import { expect, type Locator, type Page, test } from '@playwright/test';

test('onboarding, panels and lobby preserve keyboard navigation and focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const nickname = page.getByRole('textbox', { name: 'Apelido', exact: true });
  await expect(nickname).toBeFocused();
  await page.keyboard.type('Keyboard Player');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();

  for (const name of [
    'Entrar na conta',
    'Cosméticos',
    'Ranking global',
    'Configurações',
    'Como jogar',
  ]) {
    const trigger = page.getByRole('button', { name, exact: name !== 'Cosméticos' });
    await tabTo(page, trigger);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await assertContainedCycle(page, dialog);

    if (name === 'Cosméticos') {
      await tabTo(page, dialog.getByRole('tab', { name: 'Avatares', exact: true }));
      await page.keyboard.press('ArrowRight');
      await expect(dialog.getByRole('tab', { name: 'Baralhos', exact: true })).toBeFocused();
      await page.keyboard.press('End');
      await expect(dialog.getByRole('tab', { name: 'Mesas', exact: true })).toBeFocused();
      await page.keyboard.press('Home');
      await expect(dialog.getByRole('tab', { name: 'Avatares', exact: true })).toBeFocused();
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }

  const sound = page.locator('[data-audio-controls] > summary');
  await tabTo(page, sound);
  await page.keyboard.press('Enter');
  const enabled = page.getByRole('checkbox', { name: 'Efeitos sonoros', exact: true });
  await expect(enabled).toBeChecked();
  await tabTo(page, enabled);
  await page.keyboard.press('Space');
  await expect(enabled).not.toBeChecked();
  const volume = page.getByRole('slider', { name: 'Volume dos efeitos sonoros' });
  const beforeVolume = Number(await volume.inputValue());
  await tabTo(page, volume);
  await page.keyboard.press('ArrowRight');
  await expect(volume).toHaveValue(String(Math.min(100, beforeVolume + 5)));
  await tabTo(page, enabled);
  await page.keyboard.press('Space');
  await expect(enabled).toBeChecked();
  await tabTo(page, sound);
  await page.keyboard.press('Enter');
  await expect(enabled).not.toBeVisible();

  await tabTo(page, page.getByRole('button', { name: 'Criar sala', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Link de convite')).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Estou pronto', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Cancelar pronto', exact: true })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Cancelar pronto', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Estou pronto', exact: true })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Sair da sala', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
});

async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 60; step++) {
    if (await target.evaluate((node) => node === node.ownerDocument.activeElement)) return;

    await page.keyboard.press('Tab');
  }

  await expect(target).toBeFocused();
}

async function assertContainedCycle(page: Page, dialog: Locator) {
  for (const direction of ['Tab', 'Shift+Tab']) {
    for (let step = 0; step < 30; step++) {
      await page.keyboard.press(direction);
      expect(await dialog.evaluate((node) => node.contains(node.ownerDocument.activeElement))).toBe(
        true,
      );
    }
  }
}
