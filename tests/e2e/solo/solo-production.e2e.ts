import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';
import { observeRoomSnapshots } from '../support/multiplayer-flow';
import { waitForSoloTurn } from '../support/solo-flow';

for (const format of ['1v1', '2v2'] as const) {
  test(`production ${format} starts, reconnects and rematches without development tools`, async ({
    page,
  }) => {
    const snapshot = observeRoomSnapshots(page);
    const creationRequests: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        /\/api\/(guest|rooms)$/.test(new URL(request.url()).pathname)
      ) {
        creationRequests.push(request.url());
      }
    });
    await page.goto('/');
    await enterNickname(page, 'Treino');
    const trigger = page.getByRole('button', { name: 'Jogar', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Como você quer jogar?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: '1v1', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Voltar ao menu' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: '1v1', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator('.game-table')).toHaveCount(0);
    await trigger.click();
    await dialog.getByRole('button', { name: 'Voltar ao menu' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.mouse.click(0, 0);
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(creationRequests).toEqual([]);
    await trigger.click();
    const size = page.viewportSize();
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      const bounds = await dialog.boundingBox();
      if (!bounds) throw new Error('Bot format dialog is missing');
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      for (const choice of ['1v1', '2v2']) {
        const button = dialog.getByRole('button', { name: choice, exact: true });
        const box = await button.boundingBox();
        if (!box) throw new Error('Bot format choice is missing');
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        await expect(button).toBeInViewport();
      }
    }
    if (size) await page.setViewportSize(size);
    await dialog.getByRole('button', { name: format, exact: true }).click();
    await expect(page.locator('.game-table')).toContainText('Bot Treino');
    await expect(page.locator('.player-seat')).toHaveCount(format === '1v1' ? 1 : 3);
    await page.getByRole('button', { name: 'Passar preparação' }).click();
    await waitForSoloTurn(page);
    await page.locator('.own-hand .card:not(:disabled)').first().click();
    await page.reload();
    await expect(page.locator('.game-table')).toBeVisible();
    await expect(page.locator('.player-seat')).toHaveCount(format === '1v1' ? 1 : 3);
    await page.locator('.room-menu > summary').click();
    await expect(page.getByText('Ferramentas de desenvolvimento', { exact: true })).toHaveCount(0);
    await expect(page.locator('.dev-tools')).toHaveCount(0);
    await page.getByRole('button', { name: 'Sair da partida', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar desistência' }).click();
    await page.getByRole('button', { name: 'Revanche', exact: true }).click({ timeout: 12000 });
    await expect(page.locator('.game-table')).toBeVisible();
    await expect(page.locator('.stake-score')).toContainText('1');
    expect(snapshot().config.format).toBe(format);
    expect(snapshot().match?.playerCount).toBe(format === '1v1' ? 2 : 4);
    await expect(page.locator('.player-seat')).toHaveCount(format === '1v1' ? 1 : 3);
  });
}
