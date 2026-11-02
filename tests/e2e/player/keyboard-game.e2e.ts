import { expect, test } from '../support/player-test';
import { activateWithKeyboard, keyboardAndSync, tabTo } from '../support/keyboard-flow';
import { observeRoomSnapshots, waitForPresentation } from '../support/multiplayer-flow';

test('real players negotiate and finish a match using keyboard controls and accessible result actions', async ({
  page,
  browser,
  baseURL,
}, info) => {
  test.setTimeout(180_000);
  if (!baseURL) throw new Error('MISSING_BROWSER_BASE_URL');

  const origin = new URL(baseURL).origin;
  const context = await browser.newContext({
    viewport: page.viewportSize() ?? { width: 1280, height: 720 },
    reducedMotion: 'reduce',
  });
  const other = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const pages = [page, other];
  const views = [observeRoomSnapshots(page), observeRoomSnapshots(other)] as const;
  const password = 'TruC06';

  try {
    for (const [index, client] of pages.entries()) {
      const registered = await client.request.post(`${origin}/api/accounts/register`, {
        headers: { Origin: origin },
        data: {
          login: `browser_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
          password,
          nickname: `Keyboard Player ${index}`,
        },
      });
      expect(registered.status()).toBe(201);
    }
    await page.goto('/');
    await activateWithKeyboard(page, page.getByRole('button', { name: 'Criar sala', exact: true }));
    const invitation = await page.getByLabel('Link de convite').inputValue();
    await other.goto(invitation);
    await expect.poll(() => views[0]().seats.filter(Boolean).length).toBe(2);
    for (const client of pages)
      await keyboardAndSync(pages, client, client.getByRole('button', { name: 'Estou pronto' }));
    await keyboardAndSync(pages, page, page.getByRole('button', { name: 'Iniciar partida' }));

    for (let step = 0; step < 100; step++) {
      await waitForPresentation(pages);
      const room = views[0]();
      const game = room.match;
      if (!game) throw new Error('MISSING_GAME');
      if (room.status === 'finished') break;

      const phase = game.phase;
      if (phase.type === 'PREPARATION') {
        await page.screenshot({ path: info.outputPath('keyboard-preparation.png') });
        for (const client of pages) {
          const pass = client.getByRole('button', { name: 'Passar preparação' });
          if (await pass.isVisible()) await keyboardAndSync(pages, client, pass);
        }
      } else if (phase.type === 'RAISE_RESPONSE') {
        const responder = game.hand.betting.lastRaisingTeam === 'A' ? other : page;
        await keyboardAndSync(
          pages,
          responder,
          game.hand.betting.pendingStake === 12
            ? responder.getByRole('button', { name: 'Aceitar', exact: true })
            : responder.locator('[data-counter-raise]'),
        );
      } else if (phase.type === 'ELEVEN_DECISION') {
        const responder = phase.team === 'A' ? page : other;
        await keyboardAndSync(
          pages,
          responder,
          responder.getByRole('button', { name: 'Jogar por 3' }),
        );
      } else if (phase.type === 'TURN') {
        const active = pages[phase.seat];
        if (!active) throw new Error('MISSING_ACTIVE_PLAYER');

        const team = phase.seat === 0 ? 'A' : 'B';
        const raise =
          game.hand.kind === 'normal' &&
          game.hand.betting.acceptedStake < 12 &&
          game.hand.betting.lastRaisingTeam !== team;
        const target = raise
          ? active.locator('.action-truco')
          : active.locator('.hand-cards .card:enabled').first();
        await expect(target).toHaveAccessibleName(/\S/);
        await keyboardAndSync(pages, active, target);
      } else throw new Error('UNEXPECTED_GAME_PHASE');
    }

    expect(views[0]().outcome?.reason).toBe('completed');
    for (const [index, client] of pages.entries()) {
      await expect(client.locator('.game-settings-trigger')).toHaveCount(0);
      const dialog = client.getByRole('dialog', { name: 'Resultado da partida' });
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      expect(await dialog.evaluate((node) => node.contains(node.ownerDocument.activeElement))).toBe(
        true,
      );
      await expect(client.locator('.table-surface')).toHaveAttribute('inert', '');
      await expect(dialog.getByRole('region', { name: 'Recompensas da partida' })).toHaveAttribute(
        'aria-live',
        'polite',
      );
      for (const direction of ['Tab', 'Shift+Tab'])
        for (let turn = 0; turn < 8; turn++) {
          await client.keyboard.press(direction);
          expect(
            await dialog.evaluate((node) => node.contains(node.ownerDocument.activeElement)),
          ).toBe(true);
        }
      await client.screenshot({ path: info.outputPath(`keyboard-result-${index}.png`) });
    }

    await tabTo(page, page.getByRole('button', { name: 'Revanche', exact: true }));
    await page.keyboard.press('Enter');
    for (const client of pages) {
      await expect(client.getByRole('button', { name: 'Estou pronto' })).toBeVisible();
      await expect(
        client.getByRole('button', { name: 'Configurações', exact: true }),
      ).toBeVisible();
    }
    for (const client of pages) {
      await activateWithKeyboard(
        client,
        client.getByRole('button', { name: 'Sair da sala', exact: true }),
      );
      await expect(client.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
    }
  } finally {
    for (const client of pages)
      await client.request.post(`${origin}/api/accounts/delete`, {
        headers: { Origin: origin },
        data: { password },
      });
    await context.close();
  }
});
