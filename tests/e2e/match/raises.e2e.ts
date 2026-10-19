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
    browser.newContext({ viewport }),
    browser.newContext({ viewport, reducedMotion: 'reduce' }),
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
    await guest.reload();
    await expect(guest.locator('.game-table')).toBeVisible();
    await expect(guest.locator('.raise-announcement')).toHaveCount(0);
    expect(await guest.evaluate<number>('window.raiseNoteCount')).toBe(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
