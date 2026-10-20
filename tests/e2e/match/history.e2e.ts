import { expect, test, type Locator } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';
import { clickAndSync, findActivePlayer, waitForPresentation } from '../support/multiplayer-flow';

test('history follows new plays unless the reader scrolls away from the end', async ({
  page,
  browser,
}) => {
  const context = await browser.newContext();
  const guest = await context.newPage();

  try {
    await page.goto('/');
    await enterNickname(page, 'Leitor');
    await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
    await guest.goto(await page.getByLabel('Link de convite').inputValue());
    await enterNickname(guest, 'Amigo');
    await guest.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
    const pages = [page, guest];
    for (const client of pages) {
      await clickAndSync(pages, client, client.getByRole('button', { name: 'Estou pronto' }));
    }
    await clickAndSync(pages, page, page.getByRole('button', { name: 'Iniciar partida' }));
    await waitForPresentation(pages);
    for (const client of pages) {
      await clickAndSync(pages, client, client.getByRole('button', { name: 'Passar preparação' }));
    }
    const originalViewport = page.viewportSize();
    for (const viewport of [
      { width: 375, height: 667 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      const open = page.getByRole('button', { name: 'Expandir histórico' });
      await expect(open).toBeInViewport();
      await expect(page.locator('.history-list')).toBeHidden();
      await expect(page.locator('.history-empty')).toBeHidden();
      const tab = await open.boundingBox();
      if (!tab) throw new Error('Aba do histórico ausente');
      expect(tab.width).toBeGreaterThanOrEqual(44);
      expect(tab.height).toBeGreaterThanOrEqual(44);
      expect(tab.x).toBeGreaterThanOrEqual(viewport.width - 48);

      await open.click();
      await expect(page.locator('.history-empty')).toBeVisible();
      await expect(page.locator('.history-list')).toHaveCSS('visibility', 'visible');
      const panel = await page.locator('.table-history').boundingBox();
      if (!panel) throw new Error('Painel do histórico ausente');
      expect(panel.x).toBeGreaterThanOrEqual(44);
      expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width);
      expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height);
      const close = page.getByRole('button', { name: 'Recolher histórico' });
      await close.click();
      await expect(page.locator('.history-list')).toBeHidden();
      await open.click();
      await close.press('Escape');
      await expect(open).toBeFocused();
      await expect(page.locator('.history-list')).toBeHidden();
    }
    if (originalViewport) await page.setViewportSize(originalViewport);
    await page.getByRole('button', { name: 'Expandir histórico' }).click();
    // A bounded reading window guarantees overflow independently of dealt ranks and fonts.
    await page.addStyleTag({ content: '.history-list { max-height: 60px !important; }' });
    const history = page.locator('.history-list');
    const play = async () => {
      const actor = await findActivePlayer(pages);
      await clickAndSync(pages, actor, actor.locator('.hand-cards .card:enabled').first());
    };

    await play();
    await play();
    await waitForPresentation(pages);
    await expect.poll(() => history.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await expect.poll(() => distanceFromEnd(history)).toBeLessThanOrEqual(2);

    await history.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect.poll(() => history.evaluate((el) => el.scrollTop)).toBe(0);
    await page.waitForTimeout(100);
    await play();
    await expect.poll(() => history.evaluate((el) => el.scrollTop)).toBe(0);

    await history.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect.poll(() => distanceFromEnd(history)).toBeLessThanOrEqual(2);
    await page.waitForTimeout(100);
    await play();
    await expect.poll(() => distanceFromEnd(history)).toBeLessThanOrEqual(2);
    const frame = await page.locator('.table-history').boundingBox();
    const list = await history.boundingBox();
    if (!frame || !list) throw new Error('Histórico ausente');
    expect(frame.y + frame.height - list.y - list.height).toBeGreaterThanOrEqual(48);
    await expect(page.locator('.table-history')).toHaveCSS('border-bottom-width', '40px');
  } finally {
    await context.close();
  }
});

function distanceFromEnd(history: Locator) {
  return history.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
}
