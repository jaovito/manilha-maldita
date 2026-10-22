import { expect, test, type Page } from '@playwright/test';
import { guidedLessons } from '../../../apps/web/src/features/menu/components/Tutorial/Guided/lessons';
import { enterNickname } from '../support/entry-flow';

const cards: Record<string, string> = {
  low: 'Q de Paus ♣',
  trump: '2 de Ouros ♦',
  'suit-play': '2 de Paus ♣',
  exchange: 'Q de Paus ♣',
  boost: '7 de Espadas ♠',
  mask: '3 de Copas ♥',
};

async function openGuide(page: Page) {
  await page.goto('/');
  await enterNickname(page, 'Aprendiz');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Como jogar', exact: true }).click();
  await page.getByRole('button', { name: 'Jogar tutorial guiado' }).click();
}

async function assertAnchor(page: Page) {
  const coach = page.locator('.guided-coach');
  await expect(coach).toBeInViewport();
  await expect
    .poll(async () =>
      coach.evaluate((element) => {
        const selector = element.getAttribute('data-anchor');
        const target = selector
          ? element.closest('.guided-tutorial')?.querySelector(selector)
          : null;
        if (!target) return false;
        const viewport = element.ownerDocument.defaultView;
        if (!viewport) return false;
        const a = element.getBoundingClientRect();
        const b = target.getBoundingClientRect();
        const overlap =
          Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
          Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return (
          overlap < 1 &&
          a.left >= 11 &&
          a.top >= 11 &&
          a.right <= viewport.innerWidth - 11 &&
          a.bottom <= viewport.innerHeight - 11
        );
      }),
    )
    .toBe(true);
  await expect(
    page.getByRole('button', { name: /Continuar tutorial|Concluir e voltar ao menu/ }),
  ).toBeInViewport();
}

test('guided tour reuses the real table and teaches all actions without joining a room', async ({
  page,
}) => {
  const rooms: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/rooms'))
      rooms.push(request.url());
  });
  await openGuide(page);
  const scene = page.locator('.guided-scene');
  await expect(scene.locator('.game-table')).toHaveCount(1);
  await expect(scene.locator('.table-scenery')).toHaveCount(1);
  await expect(scene.locator('.team-score')).toHaveCount(2);
  await expect(scene.locator('.player-seat')).toHaveCount(1);
  for (const lesson of guidedLessons) {
    await expect(page.getByRole('heading', { name: lesson.title, exact: true })).toBeFocused();
    await assertAnchor(page);
    if (lesson.id === 'ranks') {
      const order = page.getByRole('list', { name: 'Ordem crescente de força' });
      await expect(order.getByRole('img')).toHaveCount(10);
      for (const card of await order.getByRole('img').all()) {
        await expect(card).toBeInViewport();
        expect(
          await card.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return [
              [box.left + 4, box.top + 4],
              [box.right - 4, box.bottom - 4],
            ].every(
              ([x, y]) =>
                x !== undefined &&
                y !== undefined &&
                element.contains(element.ownerDocument.elementFromPoint(x, y)),
            );
          }),
        ).toBe(true);
        const ratio = await card.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return box.width / box.height;
        });
        expect(ratio).toBeCloseTo(2 / 3, 2);
      }
    }
    if (lesson.action) {
      await expect(page.getByRole('button', { name: 'Continuar tutorial' })).toBeDisabled();
      if (lesson.power) {
        await scene.getByRole('button', { name: /^Poder / }).click();
        await assertAnchor(page);
      }
      const name =
        lesson.action === 'raise'
          ? 'Pedir Truco / aumentar'
          : lesson.action === 'spy'
            ? 'Espionar carta 1 de Seu adversário'
            : (cards[lesson.id] ?? lesson.id);
      await scene.getByRole('button', { name, exact: true }).click();
      if (lesson.result)
        await expect(page.locator('.guided-explanation')).toHaveText(lesson.result);
      await assertAnchor(page);
    }
    await page
      .getByRole('button', {
        name: lesson.id === 'finish' ? 'Concluir e voltar ao menu' : 'Continuar tutorial',
      })
      .click();
  }
  await expect(page.getByRole('button', { name: 'Como jogar', exact: true })).toBeFocused();
  expect(rooms).toHaveLength(0);
});

test('coach follows hand and vira on resize, preserves card ratio and supports language and exit', async ({
  page,
}) => {
  await openGuide(page);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 375, height: 667 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await assertAnchor(page);
    const ratio = await page
      .locator('.guided-scene .hand-cards .card-face')
      .first()
      .evaluate((element) => {
        const box = element.getBoundingClientRect();
        return box.width / box.height;
      });
    expect(ratio).toBeCloseTo(2 / 3, 1);
    await page.getByRole('button', { name: 'Continuar tutorial' }).click();
    await assertAnchor(page);
    for (const card of await page.locator('.guided-rank-card').all())
      await expect(card).toBeInViewport();
    await page.getByRole('button', { name: 'Continuar tutorial' }).click();
    await expect(page.locator('.guided-coach')).toHaveAttribute('data-anchor', '.vira-panel');
    await assertAnchor(page);
    await page.getByRole('button', { name: 'Recomeçar tutorial' }).click();
  }
  await page.locator('summary').filter({ hasText: 'Idioma do jogo' }).click();
  await page.getByLabel('Idioma do jogo').selectOption('en');
  await expect(page.getByRole('heading', { name: 'These are your three cards' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
});
