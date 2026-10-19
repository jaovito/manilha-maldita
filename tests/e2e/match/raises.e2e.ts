import { expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';
import { clickAndSync, findActivePlayer, waitForPresentation } from '../support/multiplayer-flow';

test('confirmed 3/6/9/12 raises shout for both players, synthesize distinct cues and preserve response controls', async ({
  browser,
}, testInfo) => {
  const viewport =
    testInfo.project.name === 'mobile-chromium'
      ? { width: 390, height: 844 }
      : { width: 1280, height: 720 };
  const contexts = await Promise.all([
    browser.newContext({ viewport, hasTouch: testInfo.project.name === 'mobile-chromium' }),
    browser.newContext({
      viewport,
      hasTouch: testInfo.project.name === 'mobile-chromium',
      reducedMotion: 'reduce',
    }),
  ]);
  try {
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    const host = pages[0];
    const guest = pages[1];
    if (!host || !guest) throw new Error('Missing player');
    for (const page of pages) {
      await page.addInitScript(`
        window.raiseNoteCount = 0;
        const create = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function () {
          const oscillator = create.call(this);
          const start = oscillator.start.bind(oscillator);
          oscillator.start = function (time) {
            if (oscillator.type === 'sawtooth') window.raiseNoteCount++;
            return start(time);
          };
          return oscillator;
        };
      `);
    }
    await host.goto('/');
    await enterNickname(host, 'Ana');
    await host.getByRole('button', { name: 'Criar sala', exact: true }).click();
    const invitation = await host.getByLabel('Link de convite').inputValue();
    await guest.goto(invitation);
    await enterNickname(guest, 'Beto');
    await guest.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
    for (const page of pages)
      await clickAndSync(pages, page, page.getByRole('button', { name: 'Estou pronto' }));
    await clickAndSync(pages, host, host.getByRole('button', { name: 'Iniciar partida' }));
    await waitForPresentation(pages);
    for (const page of pages)
      await clickAndSync(pages, page, page.getByRole('button', { name: 'Passar preparação' }));
    let actor = await findActivePlayer(pages);
    const raiseButton = actor.getByRole('button', { name: 'Pedir Truco / aumentar' });
    const buttonBox = await raiseButton.boundingBox();
    if (!buttonBox) throw new Error('Botão de Truco ausente');
    expect(buttonBox.width / buttonBox.height).toBeLessThanOrEqual(4.1);
    expect(buttonBox.height).toBeGreaterThanOrEqual(58);
    const artworkSize = await raiseButton.evaluate(
      (element) =>
        element.ownerDocument.defaultView?.getComputedStyle(element, '::before').backgroundSize,
    );
    expect(artworkSize).toBe('100% auto');
    const labelBox = await raiseButton.locator('.truco-label').boundingBox();
    if (!labelBox) throw new Error('Texto do Truco ausente');
    expect(
      Math.abs(labelBox.x + labelBox.width / 2 - buttonBox.x - buttonBox.width / 2),
    ).toBeLessThan(1);
    const opticalOffset = buttonBox.y + buttonBox.height / 2 - labelBox.y - labelBox.height / 2;
    expect(opticalOffset).toBeGreaterThan(3);
    expect(opticalOffset).toBeLessThan(6);
    let expectedNotes = 0;
    for (const [index, shout] of ['TRUCOOOOOOO!!', 'SEEEIS!', 'NOOVE!', 'DOOOZE!!'].entries()) {
      await clickAndSync(
        pages,
        actor,
        index === 0
          ? actor.getByRole('button', { name: 'Pedir Truco / aumentar' })
          : actor.locator('[data-counter-raise]'),
      );
      expectedNotes += index < 2 ? 4 : index === 2 ? 5 : 6;
      for (const page of pages) {
        await expect(page.locator('.raise-shout')).toHaveAttribute('aria-label', shout);
        await expect(page.locator('.raise-announcement')).toHaveCSS('pointer-events', 'none');
        await expect.poll(() => page.evaluate<number>('window.raiseNoteCount')).toBe(expectedNotes);
        const fits = await page.locator('.raise-shout').evaluate((element) => {
          const box = element.getBoundingClientRect();
          return (
            box.left >= 0 &&
            box.right <= element.ownerDocument.documentElement.clientWidth &&
            element.scrollWidth <= element.clientWidth + 1
          );
        });
        expect(fits).toBe(true);
      }
      await expect(guest.locator('.raise-shout span').first()).toHaveCSS('animation-name', 'none');
      await expect(host.locator('.raise-shout span').first()).toHaveCSS(
        'animation-name',
        'raise-letter',
      );
      actor = actor === host ? guest : host;
    }
    await expect(actor.getByRole('button', { name: 'Limite de 12', exact: true })).toBeDisabled();
    await actor.keyboard.press('Escape');
    await clickAndSync(pages, actor, actor.getByRole('button', { name: 'Aceitar', exact: true }));
    for (const page of pages) {
      await expect(page.locator('.raise-shout')).toHaveAttribute('aria-label', 'DEEESCE!!');
      await expect(page.locator('.raise-caption')).toContainText('12 pontos valendo');
      await expect
        .poll(() => page.evaluate<number>('window.raiseNoteCount'))
        .toBe(expectedNotes + 4);
      await expect(page.locator('.stake-score')).toContainText('12');
    }
    if (testInfo.project.name === 'mobile-chromium') {
      actor = await findActivePlayer(pages);
      await actor.getByRole('button', { name: 'Pedir Truco / aumentar' }).hover();
      await expect(actor.getByRole('tooltip')).toBeVisible();
      await expect(actor.getByRole('tooltip')).toHaveCSS('pointer-events', 'none');
      await clickAndSync(pages, actor, actor.locator('.hand-cards .card:enabled').first());
      await expect(actor.locator('.played-card')).toHaveCount(1);
    }

    await guest.reload();
    await expect(guest.locator('.game-table')).toBeVisible();
    await expect(guest.locator('.raise-announcement')).toHaveCount(0);
    expect(await guest.evaluate<number>('window.raiseNoteCount')).toBe(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
