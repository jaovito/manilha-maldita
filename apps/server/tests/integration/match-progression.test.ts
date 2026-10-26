import { expect, test } from 'bun:test';
import { defaultRoomConfig } from '@truco/game-protocol';
import { SQL } from 'bun';
import { localDatabaseUrl } from '../../database/target';
import { createPersistentBackend } from '../../src/bootstrap/persistent-backend';
import { withProgressionFixture } from '../database/progression-fixture';
import { controlledClock } from './controlled-clock';
import { completeMatch, setup } from './multiplayer-fixture';

import { persistentEnvironment as environment } from './persistent-fixture';

test('full HTTP/WebSocket/PostgreSQL game commits a result and grants rewards without client authority', async () => {
  await withProgressionFixture(async () => {});
  let completed: (() => void) | undefined;
  const rewarded = new Promise<void>((resolve) => {
    completed = resolve;
  });
  const backend = await createPersistentBackend(environment(), (event) => {
    if (event === 'completed') completed?.();
  });
  if (!backend) throw new Error('Missing backend');
  const clock = controlledClock();
  const game = await setup(
    2,
    { ...defaultRoomConfig, preset: 'competitive' },
    { backend, environment: 'test', ports: clock.ports },
    clock.advance,
  );
  const client = new SQL(localDatabaseUrl('test'));
  const accountIds: string[] = [];
  let matchId: string | null = null;

  try {
    for (const cookie of game.cookies) {
      const account = await backend.accounts.session(cookie.split('=')[1]);
      if (!account) throw new Error('Missing registered identity');
      accountIds.push(account.accountId);
    }
    const cookie = game.cookies[0];
    expect(
      (
        await game.post(
          '/api/accounts/cosmetics',
          { avatarId: 'avatar-4', deckThemeId: 'arcane', tableThemeId: 'midnight', level: 999 },
          cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await game.post(
          '/api/accounts/cosmetics',
          { avatarId: 'avatar-4', deckThemeId: 'arcane', tableThemeId: 'midnight' },
          cookie,
        )
      ).status,
    ).toBe(400);
    const beforeSelection = game.players[0]?.view?.sequence ?? -1;
    expect(
      (
        await game.post(
          '/api/accounts/cosmetics',
          { avatarId: 'avatar-1', deckThemeId: 'classic', tableThemeId: 'classic' },
          cookie,
        )
      ).status,
    ).toBe(200);
    // HTTP completion does not mean every WebSocket has rendered the new lobby revision.
    const selected = await game.players[0]?.wait((view) => view.sequence > beforeSelection);
    if (!selected) throw new Error('Missing cosmetic selection snapshot');
    await game.all(selected.sequence);

    await game.begin();
    matchId = game.players[0]?.view?.matchId ?? null;
    expect(game.players[1]?.view?.seats[0]?.appearance?.deck.assetKey).toBe('classic');
    await completeMatch(game);
    await rewarded;
    const winner = game.players[0]?.view?.outcome?.winner;
    for (const [seat, id] of accountIds.entries()) {
      const won = (seat === 0 ? 'A' : 'B') === winner;
      expect(await backend.players.current(id)).toMatchObject({
        xp: won ? '150' : '100',
        competitivePoints: won ? '10' : '0',
      });
    }
    expect(await client`SELECT id FROM app.match_results WHERE id = ${matchId}`).toHaveLength(1);
    const json = JSON.stringify(game.players[0]?.view);
    for (const id of accountIds) expect(json).not.toContain(id);
    expect(json).not.toMatch(/password|tokenHash|credentialId|accountId/);
    expect((await game.post('/api/accounts/logout', {}, cookie)).status).toBe(204);
    const response = await fetch(new URL('/api/guest', game.runtime.server.url), {
      headers: { Cookie: cookie ?? '' },
    });
    expect(response.status).toBe(401);
    expect((await fetch(new URL('/ready', game.runtime.server.url))).status).toBe(200);
  } finally {
    await game.stop();
    if (matchId) {
      await client`DELETE FROM app.match_results WHERE id = ${matchId}`;
      await client`DELETE FROM app.match_receipts WHERE id = ${matchId}`;
    }
    for (const id of accountIds) await client`DELETE FROM app.accounts WHERE id = ${id}`;
    await client.close();
  }
}, 15_000);
