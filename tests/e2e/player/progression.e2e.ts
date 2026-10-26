import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  observeRoomSnapshots,
  clickAndSync as synchronizeClick,
  waitForPresentation,
} from '../support/multiplayer-flow';

const password = 'Copper lanterns above the quiet river 847!';

test('earned avatar, deck and table persist across reload and render with authorized visibility', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(600_000);
  if (!baseURL) throw new Error('MISSING_BROWSER_BASE_URL');

  const origin = new URL(baseURL).origin;
  const otherContext = await browser.newContext({
    viewport: page.viewportSize() ?? { width: 1280, height: 720 },
  });
  const other = await otherContext.newPage();
  const pages = [page, other];
  const views = pages.map(observeRoomSnapshots);
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
    for (let match = 0; match < 8; match++) {
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
      if (match < 7) {
        await page
          .getByRole('button', { name: 'Revanche', exact: true })
          .click({ timeout: 10_000 });
        await expect(page.getByRole('button', { name: 'Estou pronto' })).toBeVisible();
      }
    }
    await expect
      .poll(async () => {
        const rows = await Promise.all(
          pages.map(
            async (participant) =>
              (await (
                await participant.request.get(`${origin}/api/accounts/progression`)
              ).json()) as { xp: string },
          ),
        );
        return rows.reduce((total, row) => total + BigInt(row.xp), 0n);
      })
      .toBe(2000n);
    const progress = await Promise.all(
      pages.map(
        async (participant) =>
          (await (await participant.request.get(`${origin}/api/accounts/progression`)).json()) as {
            xp: string;
          },
      ),
    );
    const owner = BigInt(progress[0]?.xp ?? '0') >= 1000n ? page : other;
    const viewer = owner === page ? other : page;
    await expect
      .poll(async () =>
        BigInt((await (await owner.request.get(`${origin}/api/accounts/progression`)).json()).xp),
      )
      .toBeGreaterThanOrEqual(1000n);
    await owner
      .getByRole('button', { name: 'Sair da sala', exact: true })
      .click({ timeout: 10_000 });
    await owner.getByRole('button', { name: /Cosm/ }).click();
    const panel = owner.getByRole('dialog');
    await panel.getByRole('tab', { name: 'Baralhos' }).click();
    await panel.getByRole('button', { name: /Brasa/ }).click();
    await panel.getByRole('button', { name: 'Equipar', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Equipado', exact: true })).toBeVisible();
    await panel.getByRole('tab', { name: 'Avatares' }).click();
    await panel.getByRole('button', { name: /Avatar 2/ }).click();
    await panel.getByRole('button', { name: 'Equipar', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Equipado', exact: true })).toBeVisible();
    await panel.getByRole('tab', { name: 'Mesas' }).click();
    await panel.getByRole('button', { name: /Vinho/ }).click();
    await panel.getByRole('button', { name: 'Equipar', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Equipado', exact: true })).toBeVisible();
    await panel.getByRole('button', { name: /Meia-noite/ }).click();
    await expect(panel.getByRole('button', { name: 'Equipar', exact: true })).toBeDisabled();
    await panel.getByRole('button', { name: 'Voltar ao menu' }).click();
    await owner.reload();
    await owner.getByRole('button', { name: /Cosm/ }).click();
    for (const [tab, item] of [
      ['Avatares', /Avatar 2/],
      ['Baralhos', /Brasa/],
      ['Mesas', /Vinho/],
    ] as const) {
      await panel.getByRole('tab', { name: tab }).click();
      await expect(panel.getByRole('button', { name: item })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(panel.getByRole('button', { name: 'Equipado', exact: true })).toBeVisible();
    }
    // Switching back to defaults must persist too; then restore the earned appearance.
    for (const [tab, original, earned] of [
      ['Avatares', /Avatar 1/, /Avatar 2/],
      ['Baralhos', /Clássico/, /Brasa/],
      ['Mesas', /Clássica/, /Vinho/],
    ] as const) {
      await panel.getByRole('tab', { name: tab }).click();
      await panel.getByRole('button', { name: original }).click();
      await panel.getByRole('button', { name: 'Equipar', exact: true }).click();
      await expect(panel.getByRole('button', { name: 'Equipado', exact: true })).toBeVisible();
      await panel.getByRole('button', { name: earned }).click();
      await panel.getByRole('button', { name: 'Equipar', exact: true }).click();
      await expect(panel.getByRole('button', { name: 'Equipado', exact: true })).toBeVisible();
    }
    await panel.getByRole('button', { name: 'Voltar ao menu' }).click();
    await owner.getByRole('button', { name: 'Criar sala', exact: true }).click();
    const nextInvitation = await owner.getByLabel('Link de convite').inputValue();
    await viewer.goto(nextInvitation);
    for (const participant of pages)
      await clickAndSync(
        pages,
        participant,
        participant.getByRole('button', { name: 'Estou pronto' }),
      );
    await clickAndSync(pages, owner, owner.getByRole('button', { name: 'Iniciar partida' }));
    await expect(owner.locator('.own-player .player-avatar')).toHaveAttribute('data-avatar', '1');
    await expect(owner.locator('.hand-cards .card-face[data-deck="ember"]')).toHaveCount(3);
    await expect(viewer.locator('.seat-cards .card-back[data-deck="ember"]')).toHaveCount(3);
    await expect(owner.locator('.seat-cards .card-back[data-deck="classic"]')).toHaveCount(3);
    await expect(owner.locator('.table-scenery')).toHaveAttribute('data-table', 'burgundy');
    await expect(viewer.locator('.table-scenery')).toHaveAttribute('data-table', 'classic');
    await expect(owner.locator('.vira-panel .card-face')).toHaveAttribute('data-deck', 'classic');
    await expect(viewer.locator('.seat-cards .card-rank')).toHaveCount(0);
    await owner.screenshot({ path: `/tmp/m5-earned-table-${test.info().project.name}.png` });
  } finally {
    for (const participant of pages) await removeAccount(participant, origin);
    await otherContext.close();
  }

  // A fresh browser project shares the same peer/IP budget. Leave one admission window
  // after the dense cosmetic/reload assertions rather than weakening server limits.
  await new Promise((resolve) => setTimeout(resolve, 60_000));
});

async function removeAccount(page: Page, origin: string) {
  await page.request.post(`${origin}/api/accounts/delete`, {
    data: { password },
    headers: { Origin: origin },
  });
}

async function clickAndSync(pages: Page[], active: Page, target: Locator) {
  await active.mouse.move(0, 0);
  await active.keyboard.press('Escape');
  // Deliberately pace real commands to respect the server's 60 messages/minute limit.
  await active.waitForTimeout(1000);
  await synchronizeClick(pages, active, target);
}
