import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';

test('layered menu loads its art and keeps entry controls readable across viewports', async ({
  page,
}) => {
  await page.goto('/');
  await enterNickname(page, 'Visitante');
  await page.evaluate('document.fonts.ready');
  await expect(page.getByRole('heading', { name: 'Manilha Maldita' })).toBeVisible();
  const art = page.locator('.menu-scenery img, .brand-logo');
  await expect
    .poll(() =>
      art.evaluateAll((images) =>
        images.every(
          (image) =>
            'complete' in image &&
            image.complete === true &&
            'naturalWidth' in image &&
            typeof image.naturalWidth === 'number' &&
            image.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);

  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    expect(await page.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth')).toBe(
      true,
    );
    await expect(page.locator('.prop-candle-body')).toHaveCSS('filter', /url/);
    await expect(page.locator('.prop-candle-body')).toHaveCSS('clip-path', 'none');
    await expect(page.locator('.prop-candle image')).toHaveCount(1);
    await expect(page.locator('.prop-candle-body')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.prop-candle-glow')).toHaveCSS(
      'animation-name',
      'prop-candle-breathe',
    );
    await expect(page.locator('.prop-candle')).toHaveCSS('pointer-events', 'none');
    const profile = page.getByRole('region', { name: 'Seu perfil' });
    expect(
      await profile.evaluate((card) => {
        const bounds = card.getBoundingClientRect();
        const info = card.querySelector('.profile-info');
        const economy = card.querySelector('.profile-economy');
        const caption = card.querySelector('.guest-caption');
        if (!info || !economy || !caption) return false;
        const content = info.getBoundingClientRect();
        const money = economy.getBoundingClientRect();
        const guest = caption.getBoundingClientRect();
        return (
          content.bottom <= bounds.bottom - 8 &&
          content.right <= bounds.right - 8 &&
          (money.height === 0 || guest.height === 0 || money.top >= guest.bottom + 6)
        );
      }),
      `Perfil sem sobreposição em ${size.width}×${size.height}`,
    ).toBe(true);
    const join = page.getByRole('button', { name: 'Entrar em sala', exact: true });
    await join.scrollIntoViewIfNeeded();
    expect(
      await join.evaluate((button) => {
        const label = button.querySelector('span:not(.menu-icon)');
        if (!label) return false;
        const range = button.ownerDocument.createRange();
        range.selectNodeContents(label);
        const text = range.getBoundingClientRect();
        const bounds = button.getBoundingClientRect();
        return text.left >= bounds.left + 8 && text.right <= bounds.right - 8;
      }),
      `Texto deve caber no botão em ${size.width}×${size.height}`,
    ).toBe(true);
    await join.click();
    await expect(page.getByLabel('Código da sala')).toBeVisible();
    await page.getByRole('button', { name: '← Voltar ao menu' }).click();
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.prop-candle-body')).toHaveCSS('filter', 'none');
  await expect(page.locator('.prop-candle-glow')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.prop-candle-body')).toHaveCSS('clip-path', 'none');
  await expect(page.locator('.scene-card-one')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.scene-power-card')).toHaveCSS('animation-name', 'none');
});

test('candle flame pixels move while wax stays fixed', async ({ page }) => {
  await page.goto('/');
  await enterNickname(page, 'Chama');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate('document.fonts.ready');
  await page.evaluate('document.getAnimations().forEach(animation => animation.pause())');
  const bounds = await page.locator('.prop-candle-art').boundingBox();
  if (!bounds) throw new Error('Vela ausente');
  const clip = (top: number, height: number) => ({
    x: Math.max(0, bounds.x + bounds.width * 0.45),
    y: bounds.y + bounds.height * top,
    width: bounds.width * 0.35,
    height: bounds.height * height,
  });
  const setTime = async (time: number) => {
    await page.evaluate(`(() => {
      const svg = document.querySelector('.prop-candle-art');
      svg.pauseAnimations();
      svg.setCurrentTime(${time});
    })()`);
  };
  await setTime(0);
  const flame = await page.screenshot({ clip: clip(0, 0.32), scale: 'css' });
  const wax = await page.screenshot({ clip: clip(0.55, 0.2), scale: 'css' });
  await setTime(0.4);
  expect((await page.screenshot({ clip: clip(0, 0.32), scale: 'css' })).equals(flame)).toBe(false);
  expect((await page.screenshot({ clip: clip(0.55, 0.2), scale: 'css' })).equals(wax)).toBe(true);
});
