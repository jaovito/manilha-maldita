import { expect, type Locator, type Page } from '@playwright/test';

export async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();

  for (let step = 0; step < 80; step++) {
    if (await target.evaluate((node) => node === node.ownerDocument.activeElement)) return;

    await page.keyboard.press('Tab');
  }

  await expect(target).toBeFocused();
}

export async function activateWithKeyboard(page: Page, target: Locator) {
  await tabTo(page, target);
  await page.keyboard.press('Enter');
}

export async function keyboardAndSync(pages: Page[], page: Page, target: Locator) {
  await expect
    .poll(async () => {
      const sequences = await Promise.all(
        pages.map((client) => client.locator('[data-sequence]').getAttribute('data-sequence')),
      );
      return sequences.every((value) => value !== null && value === sequences[0]);
    })
    .toBe(true);
  const before = Number(await page.locator('[data-sequence]').getAttribute('data-sequence'));
  await activateWithKeyboard(page, target);
  await Promise.all(
    pages.map((client) =>
      expect
        .poll(async () =>
          Number(await client.locator('[data-sequence]').getAttribute('data-sequence')),
        )
        .toBeGreaterThan(before),
    ),
  );
}
