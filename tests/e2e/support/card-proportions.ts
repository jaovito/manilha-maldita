import { expect, type Page } from '@playwright/test';

export async function assertPlayingCardRatios(page: Page) {
  // CSS layout dimensions ignore the decorative rotation of enemy backs.
  const cards = await page
    .locator('.game-table .card-face, .game-table .card-back')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const view = element.ownerDocument.defaultView;
        if (!view) throw new Error('Documento sem viewport.');
        const style = view.getComputedStyle(element);
        return {
          context: element.parentElement?.className,
          width: Number.parseFloat(style.width),
          height: Number.parseFloat(style.height),
        };
      }),
    );
  expect(cards.length).toBeGreaterThan(0);
  for (const card of cards) {
    expect(card.width, JSON.stringify(card)).toBeGreaterThan(0);
    expect(card.height, JSON.stringify(card)).toBeGreaterThan(0);
    expect(Math.abs(card.width / card.height - 2 / 3), JSON.stringify(card)).toBeLessThan(0.01);
  }
}
