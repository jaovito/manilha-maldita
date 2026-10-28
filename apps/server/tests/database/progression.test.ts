import { expect, test } from 'bun:test';
import type { MatchRecord } from '../../src/modules/progression';
import { createPlayerApplication } from '../../src/modules/progression';
import {
  ensureRewardPolicy,
  grantMatchRewards,
} from '../../src/modules/progression/adapters/outbound/postgres-rewards';
import { rewardPolicy, withProgressionFixture } from './progression-fixture';

function result(accounts: readonly string[], patch: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: crypto.randomUUID(),
    preset: 'competitive',
    format: '1v1',
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
    participants: [0, 1].map((seat) => ({ seat, accountId: accounts[seat] ?? null })),
    ...patch,
  };
}

test('authoritative results and transactional jobs award exactly once across retries and presets', async () => {
  await withProgressionFixture(async ({ client, accounts, matches, persist, queue, players }) => {
    for (const patch of [
      {},
      { preset: 'casual' as const },
      { solo: true },
      { reason: 'surrender' as const },
      { reason: 'abandonment' as const },
      { reason: 'technical' as const, winner: null },
      { reason: 'expired' as const, winner: null },
    ]) {
      const record = result(accounts, patch);
      matches.push(record.id);
      await Promise.all([persist(record), persist(record)]);
      expect(await queue.runNext()).toBe('completed');
      await client`UPDATE app.jobs SET status = 'pending', attempts = 0, finished_at = NULL WHERE match_id = ${record.id}`;
      expect(await queue.runNext()).toBe('completed');
    }
    expect(await players.current(accounts[0] ?? '')).toMatchObject({
      xp: '375',
      competitivePoints: '10',
      level: '1',
    });
    expect(await players.current(accounts[1] ?? '')).toMatchObject({
      xp: '250',
      competitivePoints: '0',
    });
    let rewards = 0;
    for (const id of matches)
      rewards += (
        await client`SELECT participant_id FROM app.match_rewards WHERE participant_id IN (SELECT id FROM app.match_participants WHERE match_id = ${id})`
      ).length;
    expect(rewards).toBe(6);
    await expect(
      ensureRewardPolicy(client, { ...rewardPolicy, completionXp: 101n }),
    ).rejects.toThrow('REWARD_POLICY_VERSION_CONFLICT');
  });
});

test('2v2 rewards use alternating teams, ignore guests/deleted/disabled accounts and rollback partial grants', async () => {
  await withProgressionFixture(async ({ client, accounts, matches, persist, queue, players }) => {
    const record = result(accounts, {
      format: '2v2',
      winner: 'B',
      scoreA: 8,
      scoreB: 12,
      participants: accounts.map((accountId, seat) => ({ accountId, seat })),
    });
    matches.push(record.id);
    await client`UPDATE app.accounts SET status = 'disabled' WHERE id = ${accounts[2]}`;
    await client`DELETE FROM app.accounts WHERE id = ${accounts[3]}`;
    await persist(record);
    const rollback = new Error('rollback fixture');
    await expect(
      client.begin(async (tx) => {
        await tx.savepoint((sp) => grantMatchRewards(sp, { matchId: record.id }));
        throw rollback;
      }),
    ).rejects.toThrow('rollback fixture');
    expect(await players.current(accounts[0] ?? '')).toMatchObject({ xp: '0' });
    expect(await queue.runNext()).toBe('completed');
    expect(await players.current(accounts[0] ?? '')).toMatchObject({
      xp: '100',
      competitivePoints: '0',
    });
    expect(await players.current(accounts[1] ?? '')).toMatchObject({
      xp: '150',
      competitivePoints: '10',
    });
    expect(await players.current(accounts[2] ?? '')).toBeNull();
    const guests = result([], { preset: 'casual' });
    matches.push(guests.id);
    await persist(guests);
    expect(await queue.runNext()).toBe('completed');
    await client`DELETE FROM app.match_results WHERE id = ${record.id}`;
    await persist(record);
    expect(await client`SELECT id FROM app.match_results WHERE id = ${record.id}`).toHaveLength(0);
  });
});

test('catalog selection derives level from locked progress and rejects forged inputs and SQL payloads', async () => {
  await withProgressionFixture(async ({ client, accounts, players }) => {
    const app = createPlayerApplication(players);
    const id = accounts[0] ?? '';
    const selection = { avatarId: 'avatar-2', deckThemeId: 'ember', tableThemeId: 'classic' };
    expect((await app.catalog()).avatars).toHaveLength(8);
    await expect(app.select(id, selection)).rejects.toThrow('COSMETIC_LOCKED');
    for (const input of [
      { ...selection, level: 999 },
      { ...selection, xp: '9999' },
      { ...selection, avatarUrl: 'https://evil.test' },
      { ...selection, deckThemeId: "x'; DROP TABLE app.accounts; --" },
      null,
      [],
      {},
    ])
      await expect(app.select(id, input)).rejects.toThrow('INVALID_SELECTION');
    expect(await app.current(id)).toMatchObject({ xp: '0', level: '1' });
    await client`UPDATE app.player_progress SET xp = 500 WHERE account_id = ${id}`;
    expect(await app.select(id, selection)).toMatchObject({
      level: '2',
      appearance: { avatar: { spriteIndex: 1 }, deck: { id: 'ember' } },
    });
    expect(
      await app.select(id, { avatarId: null, deckThemeId: null, tableThemeId: null }),
    ).toMatchObject({ appearance: { deck: { id: 'classic' } } });
    for (const page of ['', '0', '1001', '1.5', '1 OR 1=1', '1\n'])
      await expect(app.ranking(page)).rejects.toThrow('INVALID_PAGE');
    for (const nickname of ['', 'x'.repeat(25), "x'; --", null])
      await expect(app.rename(id, nickname)).rejects.toThrow('INVALID_NICKNAME');
    await app.rename(id, '  SELECT  ');
    expect(await app.current(id)).toMatchObject({ nickname: 'SELECT' });
    await client`UPDATE app.player_progress SET competitive_points = 10 WHERE account_id IN (${accounts[0]}, ${accounts[1]})`;
    const ranking = await app.ranking();
    expect(ranking.entries).toHaveLength(2);
    const ordered = accounts.slice(0, 2).sort();
    expect(ranking.entries.map((entry) => entry.nickname)).toEqual(
      ordered.map((accountId) => (accountId === id ? 'SELECT' : 'Player 1')),
    );
    expect(JSON.stringify(ranking)).not.toMatch(/accountId|login_name|password|token|session/);
    expect((await app.ranking('2')).entries).toEqual([]);
  });
});

test('profile rendering falls back when stored cosmetics are no longer unlocked and keeps bigint progress exact', async () => {
  await withProgressionFixture(async ({ client, accounts, players }) => {
    const id = accounts[0];
    await client`UPDATE app.profiles SET avatar_id = 'avatar-4', deck_theme_id = 'arcane', table_theme_id = 'midnight' WHERE account_id = ${id}`;
    expect(await players.current(id ?? '')).toMatchObject({
      level: '1',
      appearance: { avatar: { id: 'avatar-1' }, deck: { id: 'classic' }, table: { id: 'classic' } },
    });
    await client`UPDATE app.player_progress SET xp = 9223372036854775807 WHERE account_id = ${id}`;
    expect(await players.current(id ?? '')).toMatchObject({
      xp: '9223372036854775807',
      level: '18446744073709552',
      appearance: { avatar: { id: 'avatar-4' } },
    });
  });
});

test('concurrent reward consumers serialize account increments and an overflow rolls the entire grant back', async () => {
  await withProgressionFixture(async ({ client, accounts, matches, persist, queue, players }) => {
    const first = result(accounts);
    const second = result(accounts);
    matches.push(first.id, second.id);
    await persist(first);
    await persist(second);
    expect(await Promise.all([queue.runNext(), queue.runNext()])).toEqual([
      'completed',
      'completed',
    ]);
    expect(await players.current(accounts[0] ?? '')).toMatchObject({
      xp: '300',
      competitivePoints: '20',
    });
    const overflow = result(accounts);
    matches.push(overflow.id);
    await client`UPDATE app.player_progress SET xp = 9223372036854775807 WHERE account_id = ${accounts[1]}`;
    await persist(overflow);
    expect(await queue.runNext()).toBe('retry');
    expect(
      await client`SELECT participant_id FROM app.match_rewards WHERE participant_id IN (SELECT id FROM app.match_participants WHERE match_id = ${overflow.id})`,
    ).toHaveLength(0);
    expect(await players.current(accounts[0] ?? '')).toMatchObject({
      xp: '300',
      competitivePoints: '20',
    });
    await client`UPDATE app.player_progress SET xp = 200 WHERE account_id = ${accounts[1]}`;
    await client`UPDATE app.jobs SET run_at = statement_timestamp() WHERE match_id = ${overflow.id}`;
    expect(await queue.runNext()).toBe('completed');
    expect(await players.current(accounts[0] ?? '')).toMatchObject({
      xp: '450',
      competitivePoints: '30',
    });
  });
});

test('solo grants reduced XP only to its human account, never ranked points, and preserves old policies', async () => {
  await withProgressionFixture(async ({ client, accounts, matches, persist, queue, players }) => {
    const accountId = accounts[0] ?? '';
    const app = createPlayerApplication(players);
    await expect(app.matchReward(accountId, "x'; DROP TABLE app.accounts; --")).rejects.toThrow(
      'INVALID_MATCH_ID',
    );
    for (const winner of ['A', 'B'] as const) {
      const record = result([accountId], {
        solo: true,
        winner,
        scoreA: winner === 'A' ? 12 : 8,
        scoreB: winner === 'B' ? 12 : 8,
      });
      matches.push(record.id);
      expect(await players.matchReward(accountId, record.id)).toEqual({ status: 'pending' });
      await persist(record);
      expect(await players.matchReward(accountId, record.id)).toEqual({ status: 'pending' });
      expect(await queue.runNext()).toBe('completed');
      expect(await players.matchReward(accountId, record.id)).toEqual({
        status: 'granted',
        xp: winner === 'A' ? '75' : '50',
        competitivePoints: '0',
      });
      expect(await players.matchReward(accounts[2] ?? '', record.id)).toEqual({
        status: 'pending',
      });
      const rewards =
        await client`SELECT xp, competitive_points, solo FROM app.match_rewards WHERE participant_id IN (SELECT id FROM app.match_participants WHERE match_id = ${record.id})`;
      expect(rewards).toHaveLength(1);
      expect(BigInt(rewards[0]?.xp)).toBe(winner === 'A' ? 75n : 50n);
      expect(BigInt(rewards[0]?.competitive_points)).toBe(0n);
      expect(rewards[0]?.solo).toBe(true);
    }
    const legacy = { ...rewardPolicy, version: 'progression-fixture-legacy', soloXpPercent: 0 };
    await ensureRewardPolicy(client, legacy);
    const record = result([accountId], { solo: true, rewardPolicyVersion: legacy.version });
    matches.push(record.id);
    await persist(record);
    expect(await queue.runNext()).toBe('completed');
    expect(await players.current(accountId)).toMatchObject({ xp: '125', competitivePoints: '0' });
    expect(await players.matchReward(accountId, record.id)).toEqual({ status: 'none' });
    await expect(ensureRewardPolicy(client, { ...legacy, soloXpPercent: 50 })).rejects.toThrow(
      'REWARD_POLICY_VERSION_CONFLICT',
    );
    await expect(
      ensureRewardPolicy(client, { ...rewardPolicy, version: 'invalid-solo', soloXpPercent: 100 }),
    ).rejects.toThrow('INVALID_REWARD_POLICY');
  });
});

test('four new avatars keep independent level boundaries and trusted appearance assets', () =>
  withProgressionFixture(async ({ client, accounts, players }) => {
    const app = createPlayerApplication(players);
    const id = accounts[0]!;
    for (let number = 5; number <= 8; number++) {
      const selection = {
        avatarId: `avatar-${number}`,
        deckThemeId: 'classic',
        tableThemeId: 'classic',
      };
      const threshold = (number - 1) * 500;
      await client`UPDATE app.player_progress SET xp=${threshold - 1} WHERE account_id=${id}`;
      const before = await app.current(id);
      await expect(app.select(id, selection)).rejects.toThrow('COSMETIC_LOCKED');
      expect(await app.current(id)).toEqual(before);
      await client`UPDATE app.player_progress SET xp=${threshold} WHERE account_id=${id}`;
      const unlocked = await app.select(id, selection);
      expect(unlocked).toMatchObject({
        level: String(number),
        appearance: {
          avatar: {
            id: selection.avatarId,
            spriteIndex: number - 1,
            avatarUrl: `/art/avatars/avatar-${number}.png`,
          },
        },
      });
      expect(await app.current(id)).toEqual(unlocked);
    }
  }));
