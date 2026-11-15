import { devices, expect, test } from '@playwright/test';
import { enterNickname } from '../support/entry-flow';
import {
  clickAndSync,
  observeRoomSnapshots,
  waitForPresentation,
} from '../support/multiplayer-flow';

test('three friends fill a 2v2 vacancy, play with the bot, rematch and admit a fourth friend', async ({
  browser,
}, testInfo) => {
  test.setTimeout(90000);
  const mobile = testInfo.project.name.startsWith('mobile-chromium');
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () =>
      browser.newContext(
        mobile
          ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }
          : { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      ),
    ),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const humans = pages.slice(0, 3);
  const views = humans.map(observeRoomSnapshots);
  const host = pages[0];
  const late = pages[3];
  if (!host || !late) throw new Error('MISSING_CLIENT');
  try {
    await host.goto('/');
    await enterNickname(host, 'Ana');
    await host.getByRole('button', { name: 'Criar sala', exact: true }).click();
    await host.getByRole('radio', { name: '2v2', exact: true }).click();
    await expect(host.getByRole('radio', { name: '2v2' })).toBeChecked();
    await expect(host.getByRole('button', { name: 'Preencher com bots' })).toHaveCount(0);
    const invitation = await host.getByLabel('Link de convite').inputValue();
    const code = new URL(invitation).searchParams.get('room');
    if (!code) throw new Error('MISSING_ROOM');
    for (const [index, page] of humans.entries()) {
      if (index === 0) continue;
      await page.goto('/');
      await enterNickname(page, `Amigo ${index}`);
      await page.getByRole('button', { name: 'Entrar em sala', exact: true }).click();
      await page.getByLabel('Código da sala').fill(code);
      await page.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
      await expect(page.getByRole('heading', { name: `Sala ${code}` })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Preencher com bots' })).toHaveCount(0);
    }
    await expect.poll(() => views[0]?.().seats.filter((member) => member !== null).length).toBe(3);
    await clickAndSync(humans, host, host.getByRole('button', { name: 'Preencher com bots' }));
    await Promise.all(
      humans.map((page) => expect(page.getByText('Bot', { exact: true })).toBeVisible()),
    );
    await expect(host.getByRole('button', { name: 'Iniciar partida' })).toBeDisabled();
    await host.screenshot({ path: testInfo.outputPath('mixed-lobby.png'), fullPage: true });
    expect(await host.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth')).toBe(
      true,
    );
    if (mobile) {
      const start = host.getByRole('button', { name: 'Iniciar partida' });
      await start.scrollIntoViewIfNeeded();
      await host.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
      const startBounds = await start.boundingBox();
      const soundBounds = await host.locator('.audio-controls > summary').boundingBox();
      if (!startBounds || !soundBounds) throw new Error('MISSING_MOBILE_CONTROLS');
      expect(startBounds.y + startBounds.height).toBeLessThan(soundBounds.y);
    } else {
      for (const viewport of [
        { width: 1280, height: 640 },
        { width: 1280, height: 720 },
        { width: 1024, height: 768 },
        { width: 1440, height: 900 },
      ]) {
        await host.setViewportSize(viewport);
        expect(
          await host.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight'),
        ).toBe(true);
        const remove = host.getByRole('button', { name: 'Remover bots' });
        await expect(remove).toBeInViewport();
        expect(
          await remove.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            const target = element.ownerDocument.elementFromPoint(
              bounds.x + bounds.width / 2,
              bounds.y + bounds.height / 2,
            );
            return target !== null && element.contains(target);
          }),
        ).toBe(true);
        await expect(host.getByRole('button', { name: 'Iniciar partida' })).toBeInViewport();
      }
      await host.setViewportSize({ width: 1280, height: 720 });
    }
    await clickAndSync(humans, host, host.getByRole('button', { name: 'Remover bots' }));
    await expect(host.getByText('Bot', { exact: true })).toHaveCount(0);
    await clickAndSync(humans, host, host.getByRole('button', { name: 'Preencher com bots' }));
    for (const page of humans)
      await clickAndSync(
        humans,
        page,
        page.getByRole('button', { name: 'Estou pronto', exact: true }),
      );
    await clickAndSync(
      humans,
      host,
      host.getByRole('button', { name: 'Iniciar partida', exact: true }),
    );
    await waitForPresentation(humans);
    await expect.poll(() => views[0]?.().match?.playerCount).toBe(4);
    for (const page of humans)
      await clickAndSync(
        humans,
        page,
        page.getByRole('button', { name: 'Passar preparação', exact: true }),
      );
    let botPlayed = false;
    for (let step = 0; step < 24 && !botPlayed; step++) {
      await waitForPresentation(humans);
      const room = views[0]?.();
      const match = room?.match;
      if (!room || !match) throw new Error('MISSING_MATCH');
      botPlayed = [
        ...match.hand.plays,
        ...match.hand.completedTricks.flatMap((trick) => trick.plays),
      ].some((play) => play.seat === 3);
      if (botPlayed) break;
      if (match.phase.type === 'TURN' && match.phase.seat !== 3) {
        const page = humans[match.phase.seat];
        if (!page) throw new Error('MISSING_ACTOR');
        await clickAndSync(humans, page, page.locator('.own-hand .card:enabled').first());
      } else if (
        match.phase.type === 'RAISE_RESPONSE' &&
        match.hand.betting.lastRaisingTeam === 'B'
      ) {
        await clickAndSync(
          humans,
          host,
          host.getByRole('button', { name: 'Aceitar', exact: true }),
        );
      } else {
        const sequence = room.sequence;
        await expect.poll(() => views[0]?.().sequence).toBeGreaterThan(sequence);
      }
    }
    expect(botPlayed).toBe(true);
    for (const view of views) {
      const room = view();
      expect(room.solo).toBeUndefined();
      expect(room.seats[3]?.bot).toBe(true);
      expect(room.match?.hand.hands[3]?.visibility).toBe('hidden');
    }
    await host.locator('.room-menu > summary').click();
    await expect(host.getByText('Ferramentas de desenvolvimento', { exact: true })).toHaveCount(0);
    await host.getByRole('button', { name: 'Sair da partida', exact: true }).click();
    await host.getByRole('button', { name: 'Confirmar desistência' }).click();
    await host.getByRole('button', { name: 'Revanche', exact: true }).click();
    await expect(host.getByRole('heading', { name: `Sala ${code}` })).toBeVisible();
    await expect(host.getByRole('button', { name: 'Iniciar partida' })).toBeDisabled();
    await expect(host.getByText('Bot', { exact: true })).toBeVisible();
    await late.goto('/');
    await enterNickname(late, 'Quarto amigo');
    await late.getByRole('button', { name: 'Entrar em sala', exact: true }).click();
    await late.getByLabel('Código da sala').fill(code);
    await late.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
    await expect(late.getByRole('heading', { name: `Sala ${code}` })).toBeVisible();
    await Promise.all(
      pages.map((page) => expect(page.getByText('Bot', { exact: true })).toHaveCount(0)),
    );
    await expect(host.getByText('Quarto amigo · conectado · aguardando')).toBeVisible();
    expect(views[0]?.().seats.filter((member) => member !== null)).toHaveLength(4);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
