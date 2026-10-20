import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';
import { clickAndSync, waitForPresentation } from '../support/multiplayer-flow';

test('finished match returns to the menu after the result socket disconnects', async ({
  page,
  browser,
}) => {
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  let disconnected = false;
  // Forward real traffic until the authoritative result, then simulate transport loss.
  await page.routeWebSocket('**/ws', (socket) => {
    if (disconnected) {
      socket.close();
      return;
    }
    const server = socket.connectToServer();
    server.onMessage((data) => {
      socket.send(data);
      const message = JSON.parse(String(data));
      if (message.type === 'SNAPSHOT' && message.room.status === 'finished') {
        disconnected = true;
        socket.close();
        server.close();
      }
    });
  });

  try {
    await page.goto('/');
    await enterNickname(page, 'Ana');
    await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
    await guest.goto(await page.getByLabel('Link de convite').inputValue());
    await enterNickname(guest, 'Beto');
    await guest.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
    const pages = [page, guest];
    for (const client of pages) {
      await clickAndSync(pages, client, client.getByRole('button', { name: 'Estou pronto' }));
    }
    await clickAndSync(pages, page, page.getByRole('button', { name: 'Iniciar partida' }));
    await waitForPresentation(pages);
    await page.locator('.room-menu > summary').click();
    await page.getByRole('button', { name: 'Sair da partida', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar desistência' }).click();
    const result = page.getByRole('dialog', { name: 'Resultado da partida' });
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result.getByRole('button', { name: 'Revanche' })).toBeDisabled();
    await expect(result.getByRole('button', { name: 'Sair da sala' })).toBeEnabled();
    expect(
      await page.locator('.history-toggle').evaluate((button) => {
        const bounds = button.getBoundingClientRect();
        return Boolean(
          button.ownerDocument
            .elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
            ?.closest('.match-end-layer'),
        );
      }),
    ).toBe(true);
    await result.getByRole('button', { name: 'Voltar ao menu' }).click();
    await expect(result).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Criar sala', exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/room=/);
    await page.waitForTimeout(1200);
    await expect(result).toHaveCount(0);
    await expect(page.locator('.game-table')).toHaveCount(0);
  } finally {
    await guestContext.close();
  }
});
