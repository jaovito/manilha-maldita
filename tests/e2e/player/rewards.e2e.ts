import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  observeRoomSnapshots,
  clickAndSync as synchronizeClick,
  waitForPresentation,
} from '../support/multiplayer-flow';

const password = 'Copper lanterns above the quiet river 847!';

test('completed matches display committed XP and ranked points for each player', async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(600_000);
  if (!baseURL) throw new Error('MISSING_BROWSER_BASE_URL');

  const origin = new URL(baseURL).origin;
  const otherContext = await browser.newContext({
    viewport: page.viewportSize() ?? { width: 1280, height: 720 },
  });
  const other = await otherContext.newPage();
  const pages = [page, other];
  const views = pages.map(observeRoomSnapshots);
  for (const participant of pages)
    await participant.addInitScript(`
    window.__resultMusic = [];
    window.__musicFinishedAt = null;
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', event => {
          const message = JSON.parse(event.data);
          if (message.type === 'SNAPSHOT' && message.room.status === 'finished' && window.__musicFinishedAt === null)
            window.__musicFinishedAt = performance.now();
        });
      }
    };
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = create.call(this);
      const start = source.start.bind(source);
      source.start = (...args) => {
        window.__resultMusic.push({ duration: source.buffer?.duration, sinceResult: performance.now() - window.__musicFinishedAt });
        return start(...args);
      };
      return source;
    };
  `);
  try {
    for (const [index, participant] of pages.entries()) {
      const registered = await participant.request.post(`${origin}/api/accounts/register`, {
        data: {
          login: `earned_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
          password,
          nickname: `Player ${index}`,
        },
        headers: { Origin: origin },
      });
      expect(registered.ok()).toBe(true);
    }
    await page.goto('/');
    await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
    await page.getByRole('radio', { name: 'Competitivo', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Competitivo', exact: true })).toBeChecked();
    const invitation = await page.getByLabel('Link de convite').inputValue();
    await other.goto(invitation);
    await expect(other.getByRole('button', { name: 'Estou pronto' })).toBeEnabled();
    await expect.poll(() => views[0]?.().seats.filter(Boolean).length).toBe(2);
    for (const participant of pages)
      await clickAndSync(
        pages,
        participant,
        participant.getByRole('button', { name: 'Estou pronto' }),
      );
    await clickAndSync(pages, page, page.getByRole('button', { name: 'Iniciar partida' }));
    for (let step = 0; step < 100; step++) {
      await waitForPresentation(pages);
      const room = views[0]?.();
      const game = room?.match;
      if (!room || !game) throw new Error('MISSING_GAME');
      if (room.status === 'finished') break;
      const phase = game.phase;
      if (phase.type === 'PREPARATION') {
        for (const participant of pages) {
          const pass = participant.getByRole('button', { name: 'Passar preparação' });
          if (await pass.isVisible()) await clickAndSync(pages, participant, pass);
        }
      } else if (phase.type === 'RAISE_RESPONSE') {
        const responder = game.hand.betting.lastRaisingTeam === 'A' ? other : page;
        const action =
          game.hand.betting.pendingStake === 12
            ? responder.getByRole('button', { name: 'Aceitar', exact: true })
            : responder.locator('[data-counter-raise]');
        await clickAndSync(pages, responder, action);
      } else if (phase.type === 'ELEVEN_DECISION') {
        const responder = phase.team === 'A' ? page : other;
        await clickAndSync(
          pages,
          responder,
          responder.getByRole('button', { name: 'Jogar por 3' }),
        );
      } else if (phase.type === 'TURN') {
        const active = pages[phase.seat];
        if (!active) throw new Error('MISSING_PLAYER');
        const team = phase.seat === 0 ? 'A' : 'B';
        const raise =
          game.hand.kind === 'normal' &&
          game.hand.betting.acceptedStake < 12 &&
          game.hand.betting.lastRaisingTeam !== team;
        await clickAndSync(
          pages,
          active,
          raise
            ? active.locator('.action-truco')
            : active.locator('.hand-cards .card:enabled').first(),
        );
      } else throw new Error('UNEXPECTED_PHASE');
    }
    expect(views[0]?.().outcome?.reason).toBe('completed');

    for (const [index, participant] of pages.entries()) {
      const room = views[index]?.();
      if (!room?.matchId) throw new Error('MISSING_RESULT');
      const won = room.outcome?.winner === (room.selfSeat % 2 === 0 ? 'A' : 'B');
      const reward = participant.getByRole('region', { name: 'Recompensas da partida' });
      await expect(reward.getByText('Você recebeu', { exact: true })).toBeVisible();
      const amount = reward.getByText(won ? '+150 XP' : '+100 XP', { exact: true });
      await expect(amount).toBeVisible();
      expect(
        await amount.evaluate(
          (node) => node.ownerDocument.defaultView?.getComputedStyle(node).fontFamily,
        ),
      ).toContain('Arial');
      await expect(reward.getByText(won ? '+10' : '+0', { exact: true })).toBeVisible();
      await participant.getByRole('dialog', { name: 'Resultado da partida' }).waitFor();
      const music =
        await participant.evaluate<{ duration: number; sinceResult: number }[]>(
          'window.__resultMusic',
        );
      expect(music).toHaveLength(1);
      expect(music[0]?.duration).toBeGreaterThan(3.7);
      expect(music[0]?.duration).toBeLessThanOrEqual(4);
      expect(music[0]?.sinceResult).toBeGreaterThanOrEqual(1700);
      await participant.screenshot({ path: testInfo.outputPath(`rewards-${index}.png`) });
    }
    for (const participant of pages) {
      await participant.reload();
      await expect(participant.getByRole('dialog', { name: 'Resultado da partida' })).toBeVisible();
      expect(await participant.evaluate('window.__resultMusic.length')).toBe(0);
    }
  } finally {
    for (const participant of pages) {
      await participant.request.post(`${origin}/api/accounts/delete`, {
        data: { password },
        headers: { Origin: origin },
      });
    }
    await otherContext.close();
  }
});

async function clickAndSync(pages: Page[], page: Page, target: Locator) {
  await page.mouse.move(0, 0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await synchronizeClick(pages, page, target);
}
