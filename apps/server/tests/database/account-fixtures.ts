import type { SeedTransaction } from '../../database/connect';
import { accounts } from '../../database/schema';

export const fixturePasswordHash = await Bun.password.hash('database-fixture-only-password', {
  algorithm: 'argon2id',
  memoryCost: 19456,
  timeCost: 2,
});

export async function insertAccount(tx: SeedTransaction) {
  const id = crypto.randomUUID();

  await tx.insert(accounts).values({
    id,
    loginName: `u_${id.replaceAll('-', '').slice(0, 24)}`,
    passwordHash: fixturePasswordHash,
  });

  return id;
}
