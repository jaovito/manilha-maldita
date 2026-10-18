import { expect, type Locator, type Page } from '@playwright/test';
import { assertLobbyContrast } from './lobby-contrast';

export async function assertNoOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth'))
    .toBe(true);
}

export async function assertTableGeometry(page: Page, count: 2 | 4) {
  await assertNoOverflow(page);
  const arena = await page.locator('.arena').boundingBox();
  const center = await page.locator('.center-plays').boundingBox();
  const opponent = await page
    .locator(count === 2 ? '.seat-relative-1' : '.seat-relative-2')
    .boundingBox();
  const vira = await page.locator('.vira-panel').boundingBox();
  const ownPlayer = await page.locator('.own-player').boundingBox();
  if (!arena || !center || !opponent || !vira || !ownPlayer) throw new Error('Mesa incompleta.');
  expect(
    await page
      .locator(count === 2 ? '.seat-relative-1' : '.seat-relative-2')
      .evaluate((element) => element.ownerDocument.defaultView?.getComputedStyle(element).position),
  ).toBe('absolute');
  expect(opponent.width).toBeGreaterThan(0);
  expect(opponent.width).toBeLessThan(arena.width * 0.5);
  expect(vira.width).toBeLessThan(120);
  expect(vira.height).toBeGreaterThan(0);
  await assertGameViewport(page);
  expect(opponent.y + opponent.height).toBeLessThanOrEqual(center.y);
  expect(center.y + center.height, JSON.stringify({ center, ownPlayer })).toBeLessThanOrEqual(
    ownPlayer.y,
  );
  expect(Math.abs(opponent.x + opponent.width / 2 - (arena.x + arena.width / 2))).toBeLessThan(
    arena.width * 0.2,
  );
  for (const seat of await page.locator('.player-seat').all()) {
    const box = await seat.boundingBox();
    if (!box) throw new Error('Assento ausente.');
    const overlaps =
      box.x < vira.x + vira.width &&
      box.x + box.width > vira.x &&
      box.y < vira.y + vira.height &&
      box.y + box.height > vira.y;
    expect(
      overlaps,
      JSON.stringify({ seat: await seat.getAttribute('aria-label'), box, vira }),
    ).toBe(false);
  }
}

async function assertGameViewport(page: Page) {
  await expect
    .poll(() => page.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight'))
    .toBe(true);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Viewport ausente.');
  for (const selector of ['.arena', '.hand-cards', '.table-actions', '.vira-panel']) {
    const box = await page.locator(selector).boundingBox();
    if (!box) throw new Error(`Elemento essencial ausente: ${selector}`);
    expect(box.x, selector).toBeGreaterThanOrEqual(-1);
    expect(box.y, selector).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, selector).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height, selector).toBeLessThanOrEqual(viewport.height + 1);
  }
  for (const button of await page.locator('.card, .table-actions button').all()) {
    if (await button.isVisible()) await expect(button).toBeInViewport({ ratio: 1 });
  }
}

export async function checkSmallPhones(page: Page, count: 2 | 4, phase: 'initial' | 'played') {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `/tmp/truco-viewport-${viewport.width}-${count}-${phase}.png`,
      fullPage: true,
    });
    await assertTableGeometry(page, count);
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

export async function captureRoomSurface(page: Page, surface: 'menu' | 'lobby', project: string) {
  const mobile = project === 'mobile-chromium';
  await page.evaluate('document.fonts.ready');
  if (surface === 'menu') await assertMenuLayout(page);
  if (surface === 'lobby') await assertLobbyContrast(page);
  await page.screenshot({
    path: `/tmp/truco-${surface}-${mobile ? 'mobile' : 'desktop'}.png`,
    fullPage: true,
  });
  if (!mobile && surface === 'menu') {
    await assertMenuHover(page);
    const original = page.viewportSize();
    if (!original) throw new Error('Viewport ausente.');

    for (const viewport of [
      { width: 1567, height: 882 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport);
      await assertMenuLayout(page);
      await assertNoOverflow(page);
      await page.screenshot({
        path: `/tmp/truco-menu-reference-${viewport.width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize(original);
  }
  if (mobile) {
    await page.setViewportSize({ width: 844, height: 390 });
    await assertNoOverflow(page);
    if (surface === 'menu') await assertMenuLayout(page);
    if (surface === 'lobby') await assertLobbyContrast(page);
    await page.screenshot({ path: `/tmp/truco-${surface}-landscape.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
  }
}

async function assertMenuLayout(page: Page) {
  const profile = await page.locator('.guest-profile').boundingBox();
  const footer = await page.locator('.menu-footer').boundingBox();
  const viewport = page.viewportSize();
  if (!profile || !footer || !viewport) throw new Error('Menu incompleto.');

  const navigation = await page.locator('.menu-navigation').boundingBox();
  const brand = await page.locator('.entry-shell .brand').boundingBox();
  if (!navigation || !brand) throw new Error('Composição do menu incompleta.');

  if (viewport.width >= 1000) {
    expect(navigation.x / viewport.width).toBeGreaterThan(0.33);
    expect(navigation.x / viewport.width).toBeLessThan(0.39);
    expect(navigation.width / viewport.width).toBeGreaterThan(0.25);
    expect(navigation.width / viewport.width).toBeLessThan(0.34);
    expect(navigation.y / viewport.height).toBeGreaterThan(0.15);
    expect(navigation.y / viewport.height).toBeLessThan(0.23);
    expect(profile.x / viewport.width).toBeGreaterThan(0.64);
    expect(profile.y / viewport.height).toBeLessThan(0.1);
    expect(brand.x / viewport.width).toBeGreaterThan(0.09);
    expect(brand.x / viewport.width).toBeLessThan(0.16);
    expect(brand.y / viewport.height).toBeLessThan(0.07);
    expect(footer.y / viewport.height).toBeGreaterThan(0.9);
  }

  let previousBottom = 0;
  let buttonSize: { width: number; height: number } | undefined;
  for (const button of await page.locator('.menu-navigation button').all()) {
    const box = await button.boundingBox();
    if (!box) throw new Error('Ação do menu ausente.');
    buttonSize ??= box;
    expect(Math.abs(box.width - buttonSize.width)).toBeLessThan(1);
    expect(Math.abs(box.height - buttonSize.height)).toBeLessThan(1);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y).toBeGreaterThanOrEqual(previousBottom);
    expect(Math.abs(box.x + box.width / 2 - navigation.x - navigation.width / 2)).toBeLessThan(2);
    previousBottom = box.y + box.height;
    expect(box.y + box.height).toBeLessThanOrEqual(footer.y);
    const overlapsProfile =
      box.x < profile.x + profile.width &&
      box.x + box.width > profile.x &&
      box.y < profile.y + profile.height &&
      box.y + box.height > profile.y;
    expect(overlapsProfile).toBe(false);
  }
}

async function assertMenuHover(page: Page) {
  const create = page.getByRole('button', { name: 'Criar sala', exact: true });
  const stars = (button: Locator) =>
    button.evaluate((element) =>
      ['::before', '::after'].map(
        (pseudo) => element.ownerDocument.defaultView?.getComputedStyle(element, pseudo).opacity,
      ),
    );

  await expect.poll(() => stars(create)).toEqual(['0', '0']);

  for (const button of await page.locator('.menu-navigation button').all()) {
    const initial = await button.boundingBox();
    if (!initial) throw new Error('Ação do menu ausente.');

    await expect.poll(() => stars(button)).toEqual(['0', '0']);
    await button.hover();
    await expect.poll(() => stars(button)).toEqual(['1', '1']);
    await expect
      .poll(async () => (await button.boundingBox())?.width ?? 0)
      .toBeGreaterThan(initial.width * 1.02);
    const hovered = await button.boundingBox();
    expect(hovered?.width ?? 0).toBeLessThan(initial.width * 1.04);

    await page.mouse.move(0, 0);
    await expect.poll(() => stars(button)).toEqual(['0', '0']);
    await expect
      .poll(async () => Math.abs(((await button.boundingBox())?.width ?? 0) - initial.width))
      .toBeLessThan(0.1);
  }

  await create.hover();
  await expect.poll(() => stars(create)).toEqual(['1', '1']);
  await page.mouse.move(0, 0);
  await expect.poll(() => stars(create)).toEqual(['0', '0']);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await create.hover();
  await expect(create).toHaveCSS('transform', 'none');
  await expect.poll(() => stars(create)).toEqual(['1', '1']);
  await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => stars(create)).toEqual(['0', '0']);
}
