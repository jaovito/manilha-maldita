import { devices, expect, type Page, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';
import {
  clickAndSync,
  findActivePlayer,
  observeRoomSnapshots,
  waitForPresentation,
} from '../support/multiplayer-flow';

test('M4 real clients see distribution, result pauses, next leader, sound controls and reduced motion', async ({
  browser,
}, testInfo) => {
  test.setTimeout(30000);
  const mobile = testInfo.project.name === 'mobile-chromium';
  const contexts = await Promise.all(
    Array.from({ length: 2 }, () =>
      browser.newContext(
        mobile
          ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }
          : { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      ),
    ),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const host = pages[0];
  const guest = pages[1];
  if (!host || !guest) throw new Error('Jogadores ausentes.');
  const views = pages.map(observeRoomSnapshots);
  for (const page of pages) {
    await page.addInitScript(`
      window.cardFlightCount = 0;
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (frames, options) {
        if (this.parentElement?.matches('.played-card')) window.cardFlightCount++;
        return animate.call(this, frames, options);
      };
    `);
  }
  try {
    await host.goto('/');
    await enterNickname(host, 'Ana');
    await host.getByRole('button', { name: 'Criar sala', exact: true }).click();
    await expect(host.getByRole('heading', { name: /^Sala / })).toBeVisible();
    const invitation = await host.getByLabel('Link de convite').inputValue();
    await guest.goto(invitation);
    await enterNickname(guest, 'Beto');
    await guest.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
    await expect(guest.getByRole('heading', { name: /^Sala / })).toBeVisible();

    await guest.emulateMedia({ reducedMotion: 'reduce' });
    await host.locator('.audio-controls > summary').click();
    const sound = host.getByRole('checkbox', { name: 'Efeitos sonoros' });
    await expect(sound).toBeChecked();
    await sound.uncheck();
    await expect(sound).not.toBeChecked();
    await host.getByRole('slider', { name: 'Volume dos efeitos sonoros' }).fill('35');
    await expect(host.getByRole('slider', { name: 'Volume dos efeitos sonoros' })).toHaveValue(
      '35',
    );
    await host.locator('.audio-controls > summary').click();

    for (const page of pages)
      await clickAndSync(pages, page, page.getByRole('button', { name: 'Estou pronto' }));
    await clickAndSync(pages, host, host.getByRole('button', { name: 'Iniciar partida' }));
    for (const page of pages) {
      await expect(page.locator('.game-table')).toHaveAttribute('data-transition', 'deal');
      await expect(page.getByText('Distribuindo · mão 1', { exact: true })).toBeVisible();
      await expect(page.locator('.hand-cards .card:enabled')).toHaveCount(0);
      await expect(page.locator('.turn-badge')).toHaveCount(0);
    }
    const alignment = await host.locator('.deal-deck').evaluate((deck) => {
      const arena = deck.closest('.arena');
      const plays = arena?.querySelector('.center-plays');
      if (!arena || !plays) throw new Error('Mesa ausente.');
      const deckBox = deck.getBoundingClientRect();
      const playsBox = plays.getBoundingClientRect();
      return Math.abs(deckBox.x + deckBox.width / 2 - playsBox.x - playsBox.width / 2);
    });
    expect(alignment).toBeLessThanOrEqual(1);
    const deal = views[0]?.();
    expect(deal?.decisionId).toBeNull();
    expect(deal?.deadline).toBeNull();
    await expect(host.locator('.deal-card').first()).toHaveCSS(
      'animation-name',
      'deal-card-flight',
    );
    await expect(guest.locator('.table-atmosphere')).toBeHidden();
    await expect(guest.locator('.deal-card').first()).toHaveCSS('animation-name', 'none');
    await expect(guest.locator('.prop-candle-body')).toHaveCSS('filter', 'none');
    await expect(host.locator('.prop-candle-body')).not.toHaveCSS('filter', 'none');
    await expect(host.locator('.prop-candle-glow')).toHaveCSS(
      'animation-name',
      'prop-candle-breathe',
    );
    await waitForPresentation(pages);
    const preparation = host.getByRole('button', { name: 'Passar preparação', exact: true });
    const buttonBox = await preparation.boundingBox();
    const labelBox = await preparation.locator('.preparation-label').boundingBox();
    if (!buttonBox || !labelBox) throw new Error('Botão de preparação ausente.');
    expect(
      Math.abs(labelBox.x + labelBox.width / 2 - buttonBox.x - buttonBox.width / 2),
    ).toBeLessThan(1);
    const opticalOffset = buttonBox.y + buttonBox.height / 2 - labelBox.y - labelBox.height / 2;
    expect(opticalOffset).toBeGreaterThan(2);
    expect(opticalOffset).toBeLessThan(8);
    for (const page of pages)
      await clickAndSync(pages, page, page.getByRole('button', { name: 'Passar preparação' }));

    const initialActor = await findActivePlayer(pages);
    const initialIndex = pages.indexOf(initialActor);
    const initialDecision = views[initialIndex]?.().decisionId;
    const initialDeadline = views[initialIndex]?.().deadline;
    await expect(initialActor.locator('.turn-announcement')).toBeVisible();
    await expect(initialActor.locator('.turn-announcement-title')).toHaveText('SUA VEZ!');
    await expect(initialActor.locator('.turn-announcement-ribbon')).toHaveCSS(
      'pointer-events',
      'none',
    );
    await expect(initialActor.locator('.turn-announcement-ribbon')).toHaveCSS(
      'animation-name',
      initialActor === guest ? 'none' : 'turn-announcement-pop',
    );
    const announcement = await initialActor.locator('.turn-announcement').boundingBox();
    expect(announcement?.width).toBeLessThanOrEqual(507);
    await expect(initialActor.locator('.hand-cards .card:enabled')).toHaveCount(3);
    await initialActor.screenshot({
      path: `/tmp/truco-m4-turn-${testInfo.project.name}.png`,
      fullPage: true,
    });
    await expect(initialActor.locator('.turn-announcement')).toHaveCount(0, { timeout: 4000 });
    const beforeSync = views[initialIndex]?.count() ?? 0;
    await initialActor.evaluate('window.dispatchEvent(new Event("focus"))');
    await expect.poll(() => views[initialIndex]?.count() ?? 0).toBeGreaterThan(beforeSync);
    await expect(initialActor.locator('.turn-announcement')).toHaveCount(0);
    expect(views[initialIndex]?.().decisionId).toBe(initialDecision);
    expect(views[initialIndex]?.().deadline).toBe(initialDeadline);

    if (mobile) {
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 320, height: 568 },
      ]) {
        await host.setViewportSize(viewport);
        const status = await host.locator('.table-status').boundingBox();
        const menu = await host.locator('.room-menu > summary').boundingBox();
        if (!status || !menu) throw new Error('Regiões de status e Sala ausentes.');
        expect(
          status.x + status.width <= menu.x ||
            menu.x + menu.width <= status.x ||
            status.y + status.height <= menu.y ||
            menu.y + menu.height <= status.y,
        ).toBe(true);
      }
      await host.setViewportSize({ width: 390, height: 844 });
    }

    let lastActor: Page | undefined;
    for (let play = 0; play < 2; play++) {
      lastActor = await findActivePlayer(pages);
      if (play === 1) await expect(lastActor.locator('.turn-announcement')).toBeVisible();
      await clickAndSync(pages, lastActor, lastActor.locator('.hand-cards .card:enabled').first());
      await expect(lastActor.locator('.turn-announcement')).toHaveCount(0);
      await expect.poll(() => host.evaluate<number>('window.cardFlightCount')).toBe(play + 1);
      expect(await guest.evaluate<number>('window.cardFlightCount')).toBe(0);
    }
    const result = views[0]?.();
    if (!result) throw new Error('Resultado ausente.');
    const trick = result.match?.hand.completedTricks.at(-1);
    if (!trick) throw new Error('Vaza concluída ausente.');
    for (const [index, page] of pages.entries()) {
      await expect(page.locator('.game-table')).toHaveAttribute('data-transition', 'trick');
      await expect(page.locator('.resolution-feedback')).toContainText(/vaza 1/i);
      const ownTeam = (views[index]?.().selfSeat ?? 0) % 2 === 0 ? 'A' : 'B';
      const perspective =
        trick.result.winner === 'tie' ? 'tie' : trick.result.winner === ownTeam ? 'win' : 'lose';
      await expect(page.locator('.round-announcement')).toHaveAttribute('data-result', perspective);
      await expect(page.locator('.round-announcement-title')).toHaveText(
        perspective === 'tie' ? 'EMPATE!' : perspective === 'win' ? 'VOCÊ VENCEU!' : 'VOCÊ PERDEU',
      );
      await expect(page.locator('.round-announcement-caption')).toHaveText('VAZA 1');
      await expect(page.locator('.round-announcement')).toHaveCSS('pointer-events', 'none');
      await expect(page.locator('.hand-cards .card:enabled')).toHaveCount(0);
      await expect(page.locator('.turn-badge')).toHaveCount(0);
      await expect(page.locator('.turn-announcement')).toHaveCount(0);
      await expect(page.locator('.played-card[data-resolved="true"]')).toHaveCount(2);
    }
    expect(result.decisionId).toBeNull();
    expect(result.deadline).toBeNull();
    await expect(guest.locator('.round-announcement-ribbon')).toHaveCSS('animation-name', 'none');
    if (trick.result.winner !== 'tie') {
      await expect(host.locator('.played-card[data-winner="true"]')).toHaveCount(1);
      const winner = host.locator('.played-card[data-winner="true"] > span');
      await expect(winner).toHaveCSS('animation-name', 'winning-card');
      await expect(winner).toHaveCSS('animation-duration', '0.9s');
      for (const page of pages) {
        const banner = await page.locator('.round-announcement').boundingBox();
        const cards = await page.locator('.center-plays').boundingBox();
        if (!banner || !cards) throw new Error('Resultado ou cartas ausentes.');
        expect(banner.y + banner.height).toBeLessThan(cards.y);
      }
      await expect(guest.locator('.played-card[data-winner="true"] > span')).toHaveCSS(
        'animation-name',
        'none',
      );
      await expect(host.locator('.resolution-feedback')).toContainText(/manilha|maior força/);
    } else {
      await expect(host.locator('.played-card[data-winner="true"]')).toHaveCount(0);
      await expect(host.locator('.resolution-feedback')).toContainText('Empate entre equipes');
    }
    await host.screenshot({
      path: `/tmp/truco-m4-trick-${testInfo.project.name}.png`,
      fullPage: true,
    });

    const active = await findActivePlayer(pages);
    for (const page of pages) await expect(page.locator('.round-announcement')).toHaveCount(0);
    const activeIndex = pages.indexOf(active);
    expect(views[activeIndex]?.().selfSeat).toBe(trick.result.nextLeader);
    await expect(active.locator('.turn-badge')).toHaveText('Sua vez');
    await expect(active.locator('.turn-announcement')).toBeVisible();
    await expect(active.locator('.turn-explanation')).toHaveText('Você abre a próxima vaza');
    // The result dictates the leader even when it is the player who played last.
    if (active === lastActor)
      await expect(active.locator('.hand-cards .card:enabled')).toHaveCount(2);
    expect(views[activeIndex]?.().deadline).toBeGreaterThan(Date.now());

    await clickAndSync(
      pages,
      active,
      active.getByRole('button', { name: 'Pedir Truco / aumentar' }),
    );
    const responder = pages.find((page) => page !== active);
    if (!responder) throw new Error('Adversário ausente.');
    await clickAndSync(
      pages,
      responder,
      responder.getByRole('button', { name: 'Correr', exact: true }),
    );
    const handResult = views[0]?.();
    expect(handResult?.match?.phase.type).toBe('HAND_END');
    const score = handResult?.match?.score;
    for (const [index, page] of pages.entries()) {
      await expect(page.locator('.game-table')).toHaveAttribute('data-transition', 'hand');
      const ownTeam = (views[index]?.().selfSeat ?? 0) % 2 === 0 ? 'A' : 'B';
      const won =
        handResult?.match?.phase.type === 'HAND_END' && handResult.match.phase.winner === ownTeam;
      await expect(page.locator('.round-announcement')).toHaveAttribute(
        'data-result',
        won ? 'win' : 'lose',
      );
      await expect(page.locator('.round-announcement-title')).toHaveText(
        won ? 'VOCÊ VENCEU!' : 'VOCÊ PERDEU',
      );
      await expect(page.locator('.round-announcement-caption')).toHaveText('MÃO 1 · 1 PONTO');
      await expect(page.locator('.resolution-feedback')).toContainText(
        /(?:venceu|venceram) a mão · \+1 ponto/,
      );
      await expect(page.locator('.resolution-feedback')).toContainText('Houve corrida');
      await expect(page.locator('.hand-cards .card:enabled')).toHaveCount(0);
    }
    await host.screenshot({
      path: `/tmp/truco-m4-hand-${testInfo.project.name}.png`,
      fullPage: true,
    });
    await waitForPresentation(pages);
    expect(views[0]?.().match?.hand.number).toBe(2);
    expect(views[0]?.().match?.score).toEqual(score);
    await host.reload();
    await expect(host.getByRole('region', { name: 'Mesa da partida' })).toBeVisible();
    await host.locator('.room-menu > summary').click();
    await host.locator('.audio-controls > summary').click();
    await expect(host.getByRole('checkbox', { name: 'Efeitos sonoros' })).not.toBeChecked();
    await expect(host.getByRole('slider', { name: 'Volume dos efeitos sonoros' })).toHaveValue(
      '35',
    );
    await host.getByRole('checkbox', { name: 'Efeitos sonoros' }).check();
    await host.locator('.audio-controls > summary').click();
    await expect(host.getByRole('dialog', { name: 'Menu da sala' })).toBeVisible();
    await host.getByRole('button', { name: 'Sair da partida', exact: true }).click();
    await host.getByRole('button', { name: 'Continuar jogando' }).click();
    await host.getByRole('button', { name: 'Sair da partida', exact: true }).focus();
    await host.keyboard.press('Tab');
    await expect(host.getByRole('button', { name: 'Fechar menu da sala' })).toBeFocused();
    await host.keyboard.press('Escape');
    await expect(host.getByRole('dialog', { name: 'Menu da sala' })).toBeHidden();
    await host.locator('.room-menu > summary').click();
    await host.getByRole('button', { name: 'Sair da partida', exact: true }).click();
    await host.getByRole('button', { name: 'Confirmar desistência' }).click();
    await expect(
      host.getByText('Partida encerrada por desistência', { exact: true }),
    ).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
