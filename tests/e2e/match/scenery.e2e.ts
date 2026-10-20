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
    await enterNickname(page, 'Alexandre Magnífico');
    await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
    const invitation = await page.getByLabel('Link de convite').inputValue();
    await guest.goto(invitation);
    await enterNickname(guest, 'WWWWWWWWWWWWWWWWWWWWWWWW');
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

    await page.getByRole('button', { name: 'Expandir histórico' }).click();
    await expect(page.getByRole('button', { name: 'Recolher histórico' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await page.getByRole('button', { name: 'Recolher histórico' }).press('Escape');
    await expect(page.getByRole('button', { name: 'Expandir histórico' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    for (const asset of ['crest', 'crest-enemy', 'ribbon', 'ribbon-green', 'parchment', 'wood']) {
      const response = await page.request.get(`/art/table-ui/${asset}.png`);
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
    }

    for (const asset of ['rail', 'wood', 'cloth', 'ornament']) {
      const response = await page.request.get(`/art/table-layers/${asset}.png`);
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
    }

    await expect(page.locator('.game-table[data-transition]')).toHaveCount(0);

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(scene).toBeInViewport();
      const upperSeat = await page.locator('.seat-relative-1').boundingBox();
      const turnStatus = await page.locator('.table-status').boundingBox();
      if (!upperSeat || !turnStatus) throw new Error('Cabeçalho da mesa ausente');
      expect(upperSeat.y - turnStatus.y - turnStatus.height).toBeGreaterThanOrEqual(8);
      const avatar = await page.locator('.seat-relative-1 .seat-avatar').boundingBox();
      const nameplate = await page.locator('.seat-relative-1 .seat-name').boundingBox();
      if (!avatar || !nameplate) throw new Error('Identidade do adversário ausente');
      const expectedGap = viewport.width > 600 && viewport.height > 500 ? 12 : 8;
      expect(Math.abs(nameplate.x - avatar.x - avatar.width - expectedGap)).toBeLessThan(1);

      const compact = viewport.width <= 600 || viewport.height <= 500;
      if (compact) await page.getByRole('button', { name: 'Expandir histórico' }).click();
      const paper = await page.locator('.table-history').boundingBox();
      const entries = await page.locator('.history-list').boundingBox();
      if (!paper || !entries) throw new Error('Pergaminho do histórico ausente');
      expect(Math.abs(paper.width / paper.height - 614 / 768)).toBeLessThan(0.002);
      expect(entries.x - paper.x).toBeGreaterThanOrEqual(paper.width * 0.13);
      expect(paper.x + paper.width - entries.x - entries.width).toBeGreaterThanOrEqual(
        paper.width * 0.13,
      );
      if (compact) await page.getByRole('button', { name: 'Recolher histórico' }).click();
      const coin = await page.locator('.stake-score').boundingBox();
      const stakeTitle = await page.locator('.stake-score > span').boundingBox();
      const stakeValue = await page.locator('.stake-score > strong').boundingBox();
      if (!coin || !stakeTitle || !stakeValue) throw new Error('Medalhão ausente');
      expect(stakeTitle.y - coin.y).toBeGreaterThan(coin.height * 0.15);
      expect(stakeTitle.y + stakeTitle.height).toBeLessThan(stakeValue.y);
      expect(stakeValue.y + stakeValue.height).toBeLessThan(coin.y + coin.height * 0.9);
      expect(stakeTitle.width).toBeLessThan(coin.width * 0.8);
      const handLabel = await page.locator('.stake-score small').boundingBox();
      const status = await page.locator('.table-status').boundingBox();
      if (!handLabel || !status) throw new Error('Placar ou aviso de turno ausente');
      expect(handLabel.y + handLabel.height + 3).toBeLessThanOrEqual(status.y);
      for (const name of await page.locator('.seat-name, .own-player > strong').all()) {
        await expect(name).toHaveCSS('text-align', 'center');
        const fits = await name.evaluate((element) => {
          const style = element.ownerDocument.defaultView?.getComputedStyle(element);
          if (!style) throw new Error('Estilo do nome indisponível');
          return (
            Number.parseFloat(style.lineHeight) <= element.clientHeight &&
            element.scrollWidth <= element.clientWidth &&
            element.scrollHeight <= element.clientHeight
          );
        });
        expect(fits).toBe(true);
      }

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
