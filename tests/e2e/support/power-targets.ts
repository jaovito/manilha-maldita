import { expect, type Page } from '@playwright/test';
import { assertPlayingCardRatios } from './card-proportions';

const checked = new WeakMap<Page, Set<string>>();

export async function assertPowerTargetGeometry(page: Page) {
  const key = await page.locator('.power-card').getAttribute('class');
  const previous = checked.get(page) ?? new Set<string>();
  if (!key || previous.has(key)) return;

  const original = page.viewportSize();
  if (!original) throw new Error('Viewport ausente.');
  const sizes =
    original.width <= 600
      ? [original, { width: 320, height: 568 }, { width: 844, height: 390 }]
      : [original];

  for (const size of sizes) {
    await page.setViewportSize(size);
    await assertPlayingCardRatios(page);
    await expect(
      page.locator('.hand-power-prompt:visible, .compact-power-prompt:visible'),
    ).toBeInViewport({ ratio: 1 });
    const hand = await page.locator('.hand-cards').boundingBox();
    const actions = await page.locator('.table-actions').boundingBox();
    if (!hand || !actions) throw new Error('Controles da mesa ausentes.');
    const overlaps =
      hand.x < actions.x + actions.width &&
      hand.x + hand.width > actions.x &&
      hand.y < actions.y + actions.height &&
      hand.y + hand.height > actions.y;
    expect(overlaps, 'Ações não podem cobrir a mão durante seleção').toBe(false);

    for (const target of await page.locator('.spy-target-card').all()) {
      await expect(target).toBeInViewport({ ratio: 1 });
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      if (!box) throw new Error('Alvo do Espião ausente.');
      for (const element of await page.locator('.vira-panel, .seat-name').all()) {
        const other = await element.boundingBox();
        if (!other) continue;
        const obscures =
          box.x < other.x + other.width &&
          box.x + box.width > other.x &&
          box.y < other.y + other.height &&
          box.y + box.height > other.y;
        expect(
          obscures,
          JSON.stringify({
            message: 'Alvo do Espião não pode cobrir vira ou apelidos',
            box,
            other,
            element: await element.getAttribute('class'),
            size,
          }),
        ).toBe(false);
      }
    }
  }
  await page.setViewportSize(original);
  previous.add(key);
  checked.set(page, previous);
}
