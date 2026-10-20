import { expect, test } from '@playwright/test';
import { assertPlayingCardRatios } from '../support/card-proportions';
import { enterNickname } from '../support/entry-flow';
import { clickAndSync, findActivePlayer, waitForPresentation } from '../support/multiplayer-flow';

test('2v2 played cards reserve space for both vertical captions', async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const host = pages[0];
  if (!host) throw new Error('Host ausente');

  try {
    await host.goto('/');
    await enterNickname(host, 'Jorge');
    await host.getByRole('button', { name: 'Criar sala', exact: true }).click();
    await host.getByRole('radio', { name: '2v2', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Sentar no assento 4' })).toBeVisible();
    const invitation = await host.getByLabel('Link de convite').inputValue();

    for (const [index, guest] of pages.slice(1).entries()) {
      await guest.goto(invitation);
      await enterNickname(guest, `Amigo ${index}`);
      await guest.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
      await expect(guest.getByRole('heading', { name: /^Sala / })).toBeVisible();
    }
    for (const page of pages) {
      await clickAndSync(pages, page, page.getByRole('button', { name: 'Estou pronto' }));
    }
    await host.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
    for (const page of pages) {
      await expect(page.getByRole('button', { name: 'Passar preparação' })).toBeVisible();
    }
    await waitForPresentation(pages);
    for (const page of pages) {
      await clickAndSync(pages, page, page.getByRole('button', { name: 'Passar preparação' }));
    }
    for (let index = 0; index < 4; index++) {
      const player = await findActivePlayer(pages);
      await clickAndSync(pages, player, player.locator('.hand-cards .card:enabled').first());
    }
    await waitForPresentation(pages);
    await expect(host.locator('.played-card')).toHaveCount(4);

    for (const viewport of [
      { width: 375, height: 667 },
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 1280, height: 720 },
      { width: 1440, height: 1000 },
    ]) {
      await host.setViewportSize(viewport);
      await assertPlayingCardRatios(host);
      const upper = await host.locator('.play-relative-2').boundingBox();
      const lower = await host.locator('.play-relative-0').boundingBox();
      const teammate = await host.locator('.seat-relative-2').boundingBox();
      const ownPlayer = await host.locator('.own-player').boundingBox();
      if (!upper || !lower || !teammate || !ownPlayer) throw new Error('Mesa incompleta');

      expect(lower.y - upper.y - upper.height, JSON.stringify(viewport)).toBeGreaterThanOrEqual(8);
      expect(upper.y).toBeGreaterThanOrEqual(teammate.y + teammate.height);
      expect(lower.y + lower.height).toBeLessThanOrEqual(ownPlayer.y);
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
