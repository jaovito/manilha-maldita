import { expect, type Page } from '@playwright/test';

/** Choose a format through the same modal shown to players. */
export async function startSoloGame(page: Page, format: '1v1' | '2v2' = '1v1') {
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Como você quer jogar?' })
    .getByRole('button', { name: format, exact: true })
    .click();
}

/** Follow real bot raises while waiting for the human's next card decision. */
export async function waitForSoloTurn(page: Page) {
  await expect
    .poll(
      async () => {
        const accept = page.getByRole('button', { name: 'Aceitar', exact: true });
        if (await accept.isVisible()) await accept.click();

        return (await page.locator('.own-hand .card:not(:disabled)').count()) > 0;
      },
      { timeout: 10000, intervals: [100, 250, 500] },
    )
    .toBe(true);
}
