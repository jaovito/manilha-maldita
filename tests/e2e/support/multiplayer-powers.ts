import { expect, type Page } from '@playwright/test';
import { assertPlayingCardRatios } from './card-proportions';
import { clickAndSync, waitForPresentation } from './multiplayer-flow';
import { assertPowerTargetGeometry } from './power-targets';

export async function preparePowers(pages: Page[]) {
  await waitForPresentation(pages);
  const preparing = await Promise.all(
    pages.map((page) => page.getByRole('button', { name: 'Passar preparação' }).isVisible()),
  );
  if (!preparing.some(Boolean)) return;

  const spies = new Set<Page>();
  const consumed = new Set<Page>();
  for (const page of pages) {
    const pass = page.getByRole('button', { name: 'Passar preparação' });
    if (!(await pass.isVisible())) continue;
    const power = page.locator('.power-card[data-can-activate="true"]');
    if (!(await power.count())) {
      await clickAndSync(pages, page, pass);
      continue;
    }
    consumed.add(page);
    await power.click();
    await expect(page.locator('.power-panel')).toHaveCount(0);
    await assertPowerTargetGeometry(page);
    const spy = page.getByRole('button', { name: /^Espionar carta/ });
    if (await spy.count()) {
      spies.add(page);
      await clickAndSync(pages, page, spy.first());
    } else await clickAndSync(pages, page, page.locator('.hand-cards .card:enabled').first());
  }
  for (const page of pages) {
    await expect(page.locator('.spy-observation')).toHaveCount(spies.has(page) ? 1 : 0);
    await assertPlayingCardRatios(page);
    if (consumed.has(page)) await expect(page.locator('.power-card')).toHaveCount(0);
  }
}

export async function playWithPower(pages: Page[], page: Page) {
  const power = page.locator('.power-card[data-can-activate="true"]');
  if (await power.count()) {
    await power.click();
    await expect(power).toHaveAttribute('aria-pressed', 'true');
    await assertPowerTargetGeometry(page);
    // A boost can be unavailable for every remaining card; passing preserves legality.
    if ((await page.locator('.card:enabled').count()) === 0) await power.click();
  }
  const activated = await page.locator('.power-card[aria-pressed="true"]').count();
  await clickAndSync(pages, page, page.locator('.card:enabled').first());
  if (activated) await expect(page.locator('.power-card')).toHaveCount(0);

  for (const client of pages) {
    for (const hand of await client.locator('.seat-cards').all()) {
      const label = await hand.getAttribute('aria-label');
      const count = Number(label?.match(/^\d+/)?.[0]);
      expect(Number.isInteger(count)).toBe(true);
      await expect(hand.locator(':scope > .mini-card')).toHaveCount(count);
      await expect(hand.locator('.spy-memory .card-face')).toHaveCount(0);
    }
  }
}
