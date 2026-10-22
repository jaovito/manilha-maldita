import { expect } from 'bun:test';
import { connectLocalDatabase, type SeedTransaction } from '../../database/connect';
import { migrateLocalDatabase } from '../../database/migrate';
import { accounts, matchParticipants, matchResults } from '../../database/schema';

export const fixturePasswordHash = await Bun.password.hash('database-fixture-only-password', {
  algorithm: 'argon2id',
  memoryCost: 19456,
  timeCost: 2,
});

let migration: Promise<void> | undefined;

export function ensureM5Schema() {
  migration ??= (async () => {
    const connection = connectLocalDatabase('test');

    try {
      await migrateLocalDatabase(connection.db);
    } finally {
      await connection.close();
    }
  })();

  return migration;
}

export async function withM5Fixture(run: (tx: SeedTransaction) => Promise<void>) {
  await ensureM5Schema();
  const connection = connectLocalDatabase('test');
  const rollback = new Error('fixture rollback');

  try {
    await connection.db.transaction(async (tx) => {
      await run(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await connection.close();
  }
}

export async function rejectsConstraint(
  tx: SeedTransaction,
  name: string,
  run: (savepoint: SeedTransaction) => Promise<unknown>,
) {
  await expect(tx.transaction(run)).rejects.toMatchObject({ cause: { constraint: name } });
}

export async function insertAccount(tx: SeedTransaction) {
  const id = crypto.randomUUID();
  await tx.insert(accounts).values({
    id,
    loginName: `u_${id.replaceAll('-', '').slice(0, 24)}`,
    passwordHash: fixturePasswordHash,
  });

  return id;
}

export function resultValues(id = crypto.randomUUID()) {
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
