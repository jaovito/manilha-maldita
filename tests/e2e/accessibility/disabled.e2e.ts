import { expect, type Locator, type Page, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';
import { assertTooltipContrast } from '../support/lobby-contrast';

async function revealReason(page: Page, control: Locator, touch: boolean) {
  await expect(control).toBeDisabled();
  await expect(control).toHaveCSS('opacity', '0.25');
  const reason = await control.getAttribute('data-disabled-reason');
  if (!reason) throw new Error('Controle desabilitado sem motivo.');
  await control.scrollIntoViewIfNeeded();

  if (touch) {
    const box = await control.boundingBox();
    if (!box) throw new Error('Controle desabilitado fora do viewport.');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else await control.hover();
  await expect(page.getByRole('tooltip')).toHaveText(reason);
  if (!touch) {
    await page.getByRole('tooltip').hover();
    await expect(page.getByRole('tooltip')).toHaveText(reason);
  }
  await expect(control).toHaveAttribute('aria-describedby', /\S/);
  await assertTooltipContrast(page);
  const hint = await page.getByRole('tooltip').boundingBox();
  const viewport = page.viewportSize();
  if (!hint || !viewport) throw new Error('Tooltip sem geometria.');
  expect(hint.x).toBeGreaterThanOrEqual(0);
  expect(hint.y).toBeGreaterThanOrEqual(0);
  expect(hint.x + hint.width).toBeLessThanOrEqual(viewport.width);
  expect(hint.y + hint.height).toBeLessThanOrEqual(viewport.height);
}

test('disabled actions are dimmed and explain their reason on hover or touch without acting', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile-chromium';
  let guestsCreated = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/guest')
      guestsCreated++;
  });
  await page.goto('/');
  await revealReason(page, page.getByRole('button', { name: 'Continuar', exact: true }), touch);
  await enterNickname(page, 'Motivos visíveis');
  // A layout change can place a different disabled menu action under the cursor.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const future = page.locator('.menu-navigation button').first();
  await revealReason(page, future, touch);
  await expect(future).toHaveCSS('transform', 'none');
  expect(guestsCreated).toBe(0);
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Sala / })).toBeVisible();
  const start = page.getByRole('button', { name: 'Iniciar partida', exact: true });
  await revealReason(page, start, touch);
  await expect(page.locator('.game-table')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(start).toBeDisabled();
});
