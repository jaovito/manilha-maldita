import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';
import { clickAndSync } from '../support/multiplayer-flow';

test('table composes independent artwork at every viewport without intercepting play', async ({
  page,
  browser,
}) => {
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();

  try {
    await page.goto('/');
    await enterNickname(page, 'Cenário');
    await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
    const invitation = await page.getByLabel('Link de convite').inputValue();
    await guest.goto(invitation);
    await enterNickname(guest, 'Visitante');
    await guest.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
    const pages = [page, guest];
    for (const client of pages) {
      await clickAndSync(pages, client, client.getByRole('button', { name: 'Estou pronto' }));
    }
    await clickAndSync(pages, page, page.getByRole('button', { name: 'Iniciar partida' }));

    const scene = page.locator('.table-scenery');
    await expect(scene).toHaveAttribute('aria-hidden', 'true');
    await expect(scene).toHaveCSS('pointer-events', 'none');
    await expect(page.locator('.arena')).toHaveCSS('background-image', 'none');
    await expect(scene.locator('.table-ornament')).toHaveCount(4);
    await expect(scene.locator('.table-corner-props')).toHaveCount(4);
    await expect(scene.locator('.table-deck')).toHaveCount(2);
    await expect(scene.locator('.table-candle')).toHaveCount(1);
    await expect(scene.locator('button, a, input')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          "Array.from(document.querySelectorAll('.table-scenery img')).every(image => image.complete && image.naturalWidth > 0)",
        ),
      )
      .toBe(true);

    for (const asset of ['rail', 'wood', 'cloth', 'ornament']) {
      const response = await page.request.get(`/art/table-layers/${asset}.png`);
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
    }

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(scene).toBeInViewport();
      await expect(page.locator('.table-felt')).toHaveCSS('background-size', '320px auto');
      await expect
        .poll(() => page.evaluate('document.documentElement.scrollWidth'))
        .toBe(viewport.width);
      for (const corner of ['nw', 'ne', 'sw', 'se']) {
        await expect(scene.locator(`.props-${corner}`)).toBeInViewport();
      }
      const candle = await scene.locator('.table-candle').boundingBox();
      if (!candle) throw new Error('Vela ausente');
      expect(Math.abs(candle.width / candle.height - 477 / 512)).toBeLessThan(0.01);
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(scene.locator('.prop-candle-body')).toHaveCSS('filter', 'none');
    await expect(scene.locator('.prop-candle-glow')).toHaveCSS('animation-name', 'none');
    await page.getByRole('button', { name: 'Passar preparação' }).click();
    await expect(page.getByRole('button', { name: 'Passar preparação' })).toHaveCount(0);
  } finally {
    await guestContext.close();
  }
});
