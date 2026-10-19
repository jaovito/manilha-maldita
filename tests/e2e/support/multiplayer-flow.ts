import { expect, type Locator, type Page } from '@playwright/test';
import { type RoomView, serverMessageSchema } from '../../../packages/game-protocol/src';

/** Observe only the authorized room protocol, including SYNCs with the same sequence. */
export function observeRoomSnapshots(page: Page) {
  const received: RoomView[] = [];
  page.on('websocket', (socket) => {
    if (!new URL(socket.url()).pathname.startsWith('/api/rooms/')) return;

    socket.on('framereceived', ({ payload }) => {
      const message = serverMessageSchema.parse(JSON.parse(String(payload)));
      if (message.type === 'SNAPSHOT') received.push(message.room);
    });
  });

  return Object.assign(
    () => {
      const room = received.at(-1);
      if (!room) throw new Error('Snapshot autorizado ausente.');
      return room;
    },
    { count: () => received.length },
  );
}

export async function waitForPresentation(pages: Page[]) {
  await Promise.all(
    pages.map((page) => expect(page.locator('.game-table[data-transition]')).toHaveCount(0)),
  );
}

export async function clickAndSync(pages: Page[], page: Page, target: Locator) {
  const previous = Number(await page.locator('[data-sequence]').getAttribute('data-sequence'));
  await target.click();
  await Promise.all(
    pages.map((client) =>
      expect
        .poll(async () =>
          Number(await client.locator('[data-sequence]').getAttribute('data-sequence')),
        )
        .toBeGreaterThan(previous),
    ),
  );
}

export async function findActivePlayer(pages: Page[]): Promise<Page> {
  await waitForPresentation(pages);
  let active: Page | undefined;
  await expect
    .poll(async () => {
      for (const page of pages) {
        if ((await page.locator('.hand-cards .card:enabled').count()) > 0) {
          active = page;
          return true;
        }
      }
      return false;
    })
    .toBe(true);
  if (!active) throw new Error('Nenhum jogador com turno ativo.');

  return active;
}
