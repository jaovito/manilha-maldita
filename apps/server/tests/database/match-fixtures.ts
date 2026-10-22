import type { SeedTransaction } from '../../database/connect';
import { matchParticipants, matchResults } from '../../database/schema';
import { insertAccount } from './account-fixtures';

export function resultValues(id: string = crypto.randomUUID()) {
  return {
    id,
    preset: 'competitive' as const,
    format: '1v1' as const,
    solo: false,
    reason: 'completed' as const,
    winner: 'A' as const,
    scoreA: 12,
    scoreB: 8,
    handsPlayed: 7,
    powersUsed: 6,
    rewardPolicyVersion: 'fixture-v1',
    startedAt: new Date('2026-01-01T00:00:00Z'),
    finishedAt: new Date('2026-01-01T00:15:00Z'),
  };
}

export async function insertParticipant(
  tx: SeedTransaction,
  preset: 'casual' | 'competitive' = 'competitive',
  solo = false,
) {
  const result = { ...resultValues(), preset, solo };
  const accountId = await insertAccount(tx);
  const id = crypto.randomUUID();

  await tx.insert(matchResults).values(result);
  await tx
    .insert(matchParticipants)
    .values({ id, accountId, matchId: result.id, preset, format: '1v1', solo, seat: 0 });

  return { id, accountId, result };
}
