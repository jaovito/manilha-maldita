import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { accounts, matchParticipants, matchResults, matchRewards } from '../../database/schema';
import { rejectsConstraint, withDatabaseFixture } from './database-fixtures';
import { insertParticipant, resultValues } from './match-fixtures';

test('results and reward schema retain summaries without hands, seeds or generic payloads', () => {
  for (const table of [matchResults, matchParticipants, matchRewards]) {
    const config = getTableConfig(table);
    expect(config.checks.length).toBeGreaterThan(0);
    for (const column of config.columns) {
      expect(column.dataType).not.toBe('json');
      expect(column.name).not.toMatch(/token|password|cards|seed|nickname/);
    }
  }
});

test('results enforce unique matches, bounded scores, winner semantics and timestamps', () =>
  withDatabaseFixture(async (tx) => {
    const result = resultValues();
    await tx.insert(matchResults).values(result);
    await rejectsConstraint(tx, 'match_results_pkey', (sp) =>
      sp.insert(matchResults).values(result),
    );
    await rejectsConstraint(tx, 'match_results_scores', (sp) =>
      sp
        .insert(matchResults)
        .values({ ...result, id: 'bad-score', reason: 'surrender', scoreA: 13 }),
    );
    await rejectsConstraint(tx, 'match_results_completed', (sp) =>
      sp.insert(matchResults).values({ ...result, id: 'bad-completed', scoreA: 11 }),
    );
    await rejectsConstraint(tx, 'match_results_winner', (sp) =>
      sp.insert(matchResults).values({ ...result, id: 'bad-technical', reason: 'technical' }),
    );
    await rejectsConstraint(tx, 'match_results_winner', (sp) =>
      sp
        .insert(matchResults)
        .values({ ...result, id: 'bad-surrender', reason: 'surrender', winner: null }),
    );
    await rejectsConstraint(tx, 'match_results_time', (sp) =>
      sp
        .insert(matchResults)
        .values({ ...result, id: 'bad-time', finishedAt: new Date('2025-01-01') }),
    );
    await rejectsConstraint(tx, 'match_results_counts', (sp) =>
      sp.insert(matchResults).values({ ...result, id: 'bad-count', handsPlayed: -1 }),
    );
    await rejectsConstraint(tx, 'match_results_policy', (sp) =>
      sp.insert(matchResults).values({ ...result, id: 'bad-policy', rewardPolicyVersion: '' }),
    );
    await rejectsConstraint(tx, 'match_results_solo', (sp) =>
      sp.insert(matchResults).values({ ...result, id: 'bad-solo', solo: true, format: '2v2' }),
    );

    await tx
      .insert(matchResults)
      .values({ ...result, id: 'valid-technical', reason: 'technical', winner: null, scoreA: 4 });
    await tx
      .insert(matchResults)
      .values({ ...result, id: 'valid-b', winner: 'B', scoreA: 8, scoreB: 12 });
    await tx
      .insert(matchResults)
      .values({ ...result, id: 'valid-surrender', reason: 'surrender', scoreA: 2, scoreB: 4 });
  }));

test('participants cannot forge context, occupy two seats with one account, or exceed format capacity', () =>
  withDatabaseFixture(async (tx) => {
    const { id, accountId, result } = await insertParticipant(tx);
    const value = {
      matchId: result.id,
      accountId,
      seat: 1,
      preset: result.preset,
      format: result.format,
      solo: false,
    };
    await rejectsConstraint(tx, 'match_participants_account_unique', (sp) =>
      sp.insert(matchParticipants).values(value),
    );
    await rejectsConstraint(tx, 'match_participants_seat_unique', (sp) =>
      sp.insert(matchParticipants).values({ ...value, accountId: null, seat: 0 }),
    );
    await rejectsConstraint(tx, 'match_participants_seat', (sp) =>
      sp.insert(matchParticipants).values({ ...value, accountId: null, seat: 2 }),
    );
    await rejectsConstraint(tx, 'match_participants_context_fk', (sp) =>
      sp.insert(matchParticipants).values({ ...value, accountId: null, preset: 'casual' }),
    );

    await tx.insert(matchParticipants).values({ ...value, accountId: null });
    const four = { ...resultValues(), format: '2v2' as const };
    await tx.insert(matchResults).values(four);
    await tx.insert(matchParticipants).values(
      [0, 1, 2, 3].map((seat) => ({
        matchId: four.id,
        seat,
        format: four.format,
        preset: four.preset,
        solo: false,
      })),
    );
    expect(
      await tx.select().from(matchParticipants).where(eq(matchParticipants.matchId, four.id)),
    ).toHaveLength(4);

    await tx.insert(matchRewards).values({
      participantId: id,
      preset: 'competitive',
      solo: false,
      xp: 20n,
      competitivePoints: 10n,
    });
    await tx.delete(accounts).where(eq(accounts.id, accountId));
    expect(
      (await tx.select().from(matchParticipants).where(eq(matchParticipants.id, id)))[0]?.accountId,
    ).toBeNull();
    expect(
      await tx.select().from(matchRewards).where(eq(matchRewards.participantId, id)),
    ).toHaveLength(1);
  }));

test('reward uniqueness and linked context reject duplicated grants and competitive points in casual or solo', () =>
  withDatabaseFixture(async (tx) => {
    const competitive = await insertParticipant(tx);
    const reward = {
      participantId: competitive.id,
      preset: 'competitive' as const,
      solo: false,
      xp: 30n,
      competitivePoints: 10n,
    };
    await tx.insert(matchRewards).values(reward);
    await rejectsConstraint(tx, 'match_rewards_pkey', (sp) =>
      sp.insert(matchRewards).values(reward),
    );
    await rejectsConstraint(tx, 'match_rewards_xp', (sp) =>
      sp
        .update(matchRewards)
        .set({ xp: -1n })
        .where(eq(matchRewards.participantId, competitive.id)),
    );
    await rejectsConstraint(tx, 'match_rewards_points', (sp) =>
      sp
        .update(matchRewards)
        .set({ competitivePoints: -1n })
        .where(eq(matchRewards.participantId, competitive.id)),
    );

    for (const [preset, solo] of [
      ['casual', false],
      ['competitive', true],
    ] as const) {
      const participant = await insertParticipant(tx, preset, solo);
      await rejectsConstraint(tx, 'match_rewards_points', (sp) =>
        sp.insert(matchRewards).values({ ...reward, participantId: participant.id, preset, solo }),
      );
      await rejectsConstraint(tx, 'match_rewards_context_fk', (sp) =>
        sp.insert(matchRewards).values({
          ...reward,
          participantId: participant.id,
          preset: preset === 'casual' ? 'competitive' : 'casual',
          competitivePoints: 0n,
          solo,
        }),
      );
      await tx
        .insert(matchRewards)
        .values({ ...reward, participantId: participant.id, preset, solo, competitivePoints: 0n });
    }

    await tx.delete(matchResults).where(eq(matchResults.id, competitive.result.id));
    expect(
      await tx.select().from(matchRewards).where(eq(matchRewards.participantId, competitive.id)),
    ).toEqual([]);
  }));
