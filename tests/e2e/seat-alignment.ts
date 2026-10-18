import { expect, type Page } from '@playwright/test';

export async function assertSeatAlignment(page: Page) {
  const cards = await page.locator('.lobby-shell .lobby-seat').all();
  expect(cards).toHaveLength(4);
  let reference: { height: number; actionTop: number; actionHeight: number } | undefined;
  let actionReference: { top: number; height: number; width: number } | undefined;

  for (const card of cards) {
    const box = await card.boundingBox();
    const slot = await card.locator('.seat-actions').boundingBox();
    if (!box || !slot) throw new Error('MISSING_SEAT_GEOMETRY');
    reference ??= { height: box.height, actionTop: slot.y - box.y, actionHeight: slot.height };

    expect(Math.abs(box.height - reference.height)).toBeLessThan(1);
    expect(Math.abs(slot.y - box.y - reference.actionTop)).toBeLessThan(1);
    expect(Math.abs(slot.height - reference.actionHeight)).toBeLessThan(1);
    const button = card.getByRole('button');
    if (await button.count()) {
      const control = await button.boundingBox();
      const contentFits = await button.evaluate(
        (element) => element.scrollHeight <= element.clientHeight,
      );
      if (!control) throw new Error('MISSING_SEAT_ACTION');
      actionReference ??= { top: control.y - box.y, height: control.height, width: control.width };
      expect(Math.abs(control.y - box.y - actionReference.top)).toBeLessThan(1);
      expect(Math.abs(control.height - actionReference.height)).toBeLessThan(1);
      expect(Math.abs(control.width - actionReference.width)).toBeLessThan(1);
      expect(control.height).toBeGreaterThanOrEqual(44);
      expect(control.y + control.height).toBeLessThanOrEqual(box.y + box.height);
      expect(contentFits).toBe(true);
    }
  }
}
