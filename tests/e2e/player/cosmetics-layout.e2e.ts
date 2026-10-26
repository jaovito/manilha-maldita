import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';

test('table cosmetic previews stay centered inside their items on small and desktop viewports', async ({
  page,
}) => {
  await page.goto('/');
  await enterNickname(page, 'Table Preview');
  await page.getByRole('button', { name: /Cosméticos/ }).click();
  await page.getByRole('tab', { name: 'Mesas' }).click();
  const items = page.locator('.cosmetic-item');
  await expect(items).toHaveCount(3);

  for (const width of [320, 390, 680, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : width < 700 ? 844 : 900 });
    for (const item of await items.all()) {
      await item.scrollIntoViewIfNeeded();
      const bounds = await item.boundingBox();
      const preview = await item.locator('.cosmetic-table').boundingBox();
      if (!bounds || !preview) throw new Error('MISSING_TABLE_PREVIEW');

      if (width > 700) {
        const title = await item.locator('strong').boundingBox();
        if (!title) throw new Error('MISSING_TABLE_TITLE');

        expect(title.y - preview.y - preview.height).toBeGreaterThanOrEqual(24);
      }
      expect(preview.x).toBeGreaterThanOrEqual(bounds.x + 2);
      expect(preview.x + preview.width).toBeLessThanOrEqual(bounds.x + bounds.width - 2);
      expect(
        Math.abs(preview.x + preview.width / 2 - bounds.x - bounds.width / 2),
      ).toBeLessThanOrEqual(1);
    }
    const panel = page.getByRole('dialog');
    const principle = panel.getByText(/Só muda o visual\. Todos os poderes/);
    await expect(principle).toHaveCount(1);
    await expect(panel.locator('footer').getByText(/Só muda o visual/)).toBeVisible();

    expect(await panel.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
});

test('desktop cosmetic collections fit without scrolling or clipped controls', async ({ page }) => {
  await page.goto('/');
  await enterNickname(page, 'Desktop Collection');
  await page.getByRole('button', { name: /Cosméticos/ }).click();
  const panel = page.getByRole('dialog');
  const body = panel.locator('.player-panel-body');

  for (const [width, height] of [
    [1024, 600],
    [1280, 720],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const tab of ['Avatares', 'Baralhos', 'Mesas']) {
      await panel.getByRole('tab', { name: tab }).click();
      await expect(panel.locator('.cosmetic-item').first()).toBeVisible();
      await expect
        .poll(() => body.evaluate((node) => node.scrollHeight - node.clientHeight), {
          message: `${width}x${height}: ${tab}`,
        })
        .toBeLessThanOrEqual(1);
      const bounds = await body.boundingBox();
      if (!bounds) throw new Error('MISSING_COLLECTION_BODY');
      for (const item of await panel.locator('.cosmetic-item').all()) {
        const box = await item.boundingBox();
        if (!box) throw new Error('MISSING_COLLECTION_ITEM');

        expect(box.y).toBeGreaterThanOrEqual(bounds.y);
        expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height);
      }
      if (tab === 'Mesas') {
        const stage = await panel.locator('.cosmetic-showcase .cosmetic-art').boundingBox();
        const table = await panel.locator('.cosmetic-showcase .cosmetic-table').boundingBox();
        if (!stage || !table) throw new Error('MISSING_TABLE_SHOWCASE');

        expect(table.y).toBeGreaterThanOrEqual(stage.y);
        expect(table.y + table.height).toBeLessThanOrEqual(stage.y + stage.height);
      }
      await expect(panel.getByRole('button', { name: 'Voltar ao menu' })).toBeInViewport();
    }
  }
});

test('deck previews fit their cards and showcase on narrow mobile screens', async ({ page }) => {
  await page.goto('/');
  await enterNickname(page, 'Deck Preview');
  await page.getByRole('button', { name: /Cosméticos/ }).click();
  await page.getByRole('tab', { name: 'Baralhos' }).click();
  await page.locator('html').evaluate((node) => node.ownerDocument.fonts.ready);
  const typography = await page.locator('.cosmetic-item .card-rank').evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = node.ownerDocument.defaultView?.getComputedStyle(node);
      return { family: style?.fontFamily, weight: style?.fontWeight, shadow: style?.textShadow };
    }),
  );
  expect(typography).toHaveLength(12);
  for (const rank of typography) {
    expect(rank.family).toContain('Jersey 10');
    expect(rank.weight).toBe('400');
    expect(rank.shadow).toBe('none');
  }

  for (const width of [320, 375, 390, 680]) {
    await page.setViewportSize({ width, height: width <= 375 ? 667 : 844 });
    for (const preview of await page.locator('.cosmetic-art:has(.deck-fan)').all()) {
      await preview.scrollIntoViewIfNeeded();
      const bounds = await preview.boundingBox();
      if (!bounds) throw new Error('MISSING_DECK_PREVIEW');

      for (const card of await preview.locator('.deck-fan > span').all()) {
        const box = await card.boundingBox();
        if (!box) throw new Error('MISSING_DECK_CARD');

        expect(box.x).toBeGreaterThanOrEqual(bounds.x);
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
        expect(box.y).toBeGreaterThanOrEqual(bounds.y);
        expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height);
      }
    }
  }
});

test('arcane corner suits remain separated from their ranks at desktop and mobile sizes', async ({
  page,
}) => {
  await page.goto('/');
  await enterNickname(page, 'Arcane Preview');
  await page.getByRole('button', { name: /Cosméticos/ }).click();
  await page.getByRole('tab', { name: 'Baralhos' }).click();
  await page.getByRole('button', { name: /Arcano/ }).click();

  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: width < 700 ? 667 : 720 });
    const corners = page.locator('.cosmetic-showcase [data-deck="arcane"] .card-corner');
    await expect(corners).toHaveCount(4);
    for (const corner of await corners.all()) {
      const gap = await corner.evaluate((node) => {
        const rank = node.querySelector('.card-rank');
        const suit = rank?.nextElementSibling;
        if (!rank || !suit) throw new Error('MISSING_CORNER_CONTENT');

        const rankTop = 'offsetTop' in rank ? Number(rank.offsetTop) : NaN;
        const rankHeight = 'offsetHeight' in rank ? Number(rank.offsetHeight) : NaN;
        const suitTop = 'offsetTop' in suit ? Number(suit.offsetTop) : NaN;

        return (
          (suitTop - rankTop - rankHeight) /
          parseFloat(node.ownerDocument.defaultView?.getComputedStyle(node).fontSize ?? '0')
        );
      });
      expect(gap).toBeGreaterThan(0.1);
    }
  }
});
