import { expect, type Page } from '@playwright/test';
import type { RoomView } from '../../../packages/game-protocol/src';

export async function assertCompletedMatch(
  pages: Page[],
  views: Array<(() => RoomView) & { count: () => number }>,
  count: 2 | 4,
  project: string,
) {
  const perspectives = pages.map((page, index) => {
    const room = views[index]?.();
    if (!room?.outcome?.winner || !room.match) throw new Error('Final natural ausente.');
    expect(room.outcome.reason).toBe('completed');
    expect(room.match.score[room.outcome.winner]).toBe(12);

    const ownTeam = room.selfSeat % 2 === 0 ? 'A' : 'B';
    return { page, won: room.outcome.winner === ownTeam };
  });
  expect(perspectives.filter(({ won }) => won)).toHaveLength(count / 2);

  await Promise.all(
    perspectives.map(async ({ page, won }) => {
      const subject = count === 4 ? 'SEU TIME' : 'VOCÊ';
      await expect(page.locator('.match-end-layer')).toHaveAttribute('data-stage', 'celebration');
      await expect(page.locator('.room-menu')).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Lobby' })).toHaveCount(0);
      await expect(page.locator('.match-end-actions')).toHaveCount(0);
      await expect(page.locator('.match-result-panel')).toHaveAttribute(
        'data-result',
        won ? 'win' : 'lose',
      );
      await expect(page.locator('.match-result-title')).toHaveText(
        `${subject} ${won ? 'VENCEU!!' : 'PERDEU'}`,
      );
      await expect(page.locator('.match-result-title')).toBeInViewport();
      await expect(page.locator('.pixel-confetti')).toHaveCount(won ? 48 : 0);
      await expect(page.locator('.pixel-burst')).toHaveCount(won ? 0 : 24);
      if (won)
        await expect(page.locator('.pixel-confetti-layer')).toHaveCSS('pointer-events', 'none');
    }),
  );

  const winner = perspectives.find(({ won }) => won)?.page;
  const loser = perspectives.find(({ won }) => !won)?.page;
  if (!winner || !loser) throw new Error('Perspectivas de vitória e derrota ausentes.');

  await winner.screenshot({ path: `/tmp/truco-m4-finish-win-${count}-${project}.png` });
  await loser.screenshot({ path: `/tmp/truco-m4-finish-lose-${count}-${project}.png` });
  await winner.emulateMedia({ reducedMotion: 'reduce' });
  await expect(winner.locator('.pixel-confetti-layer')).toBeHidden();
  await expect(winner.locator('.pixel-confetti').first()).toHaveCSS('animation-name', 'none');
  await winner.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(winner.locator('.pixel-confetti-layer')).toHaveCount(0, { timeout: 6000 });

  for (const [index, page] of pages.entries()) {
    const room = views[index]?.();
    if (!room) throw new Error('Assento de pós-partida ausente.');

    await expect(page.locator('.match-end-layer')).toHaveAttribute('data-stage', 'menu');
    await expect(page.locator('.match-result-panel')).toHaveAttribute('role', 'dialog');
    await expect(page.locator('.match-end-actions button')).toHaveCount(3);
    await expect(page.getByRole('region', { name: 'Lobby' })).toHaveCount(0);
    await expect(page.locator('.audio-controls')).toHaveCount(0);
    await expect(page.locator('.match-result-title')).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Sair da sala', exact: true })).toBeInViewport();
    for (const name of ['Revanche', 'Voltar ao lobby']) {
      const action = page.getByRole('button', { name, exact: true });
      await expect(action).toBeInViewport();
      if (room.selfSeat === room.hostSeat) await expect(action).toBeEnabled();
      else await expect(action).toBeDisabled();
    }
  }
  await winner.screenshot({ path: `/tmp/truco-m4-compact-win-${count}-${project}.png` });
  await loser.screenshot({ path: `/tmp/truco-m4-compact-lose-${count}-${project}.png` });

  const winnerView = views[pages.indexOf(winner)];
  const beforeSync = winnerView?.count() ?? 0;
  await winner.evaluate('window.dispatchEvent(new Event("focus"))');
  await expect.poll(() => winnerView?.count() ?? 0).toBeGreaterThan(beforeSync);
  await expect(winner.locator('.pixel-confetti-layer')).toHaveCount(0);
  await winner.reload();
  await expect(winner.locator('.match-end-layer')).toHaveAttribute('data-stage', 'menu');
  await expect(winner.locator('.match-result-title')).toHaveText(
    `${count === 4 ? 'SEU TIME' : 'VOCÊ'} VENCEU!!`,
  );
  await expect(winner.locator('.pixel-confetti-layer')).toHaveCount(0);
}
