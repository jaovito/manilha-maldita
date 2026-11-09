import { expect, test } from 'bun:test';
import type { MatchRecord } from '../../src/modules/progression';
import { rewardPolicy, withProgressionFixture } from './progression-fixture';

test('mixed multiplayer keeps full XP and competitive points for three humans while a bot seat receives no grant', async () => {
  await withProgressionFixture(async ({ client, accounts, matches, persist, queue, players }) => {
    const record: MatchRecord = {
      id: crypto.randomUUID(),
      preset: 'competitive',
      format: '2v2',
      solo: false,
      reason: 'completed',
      winner: 'A',
      scoreA: 12,
      scoreB: 8,
      handsPlayed: 4,
      powersUsed: 2,
      rewardPolicyVersion: rewardPolicy.version,
      startedAt: Date.now() - 1000,
      finishedAt: Date.now(),
      participants: [0, 1, 2, 3].map((seat) => ({
        seat,
        accountId: seat === 3 ? null : (accounts[seat] ?? null),
      })),
    };
    matches.push(record.id);
    await persist(record);
    expect(await queue.runNext()).toBe('completed');
    for (const seat of [0, 1, 2]) {
      expect(await players.current(accounts[seat] ?? '')).toMatchObject({
        xp: seat % 2 === 0 ? '150' : '100',
        competitivePoints: seat % 2 === 0 ? '10' : '0',
      });
    }
    const grants: readonly { seat: number }[] =
      await client`SELECT p.seat FROM app.match_rewards r JOIN app.match_participants p ON p.id = r.participant_id WHERE p.match_id = ${record.id} ORDER BY p.seat`;
    expect(grants.map((row) => row.seat)).toEqual([0, 1, 2]);
    expect(await players.current(accounts[3] ?? '')).toMatchObject({
      xp: '0',
      competitivePoints: '0',
    });
  });
});
