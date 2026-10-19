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
