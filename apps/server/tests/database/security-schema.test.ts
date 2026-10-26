import { expect, test } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { accountSecurity, authAudit, matchReceipts, rewardPolicies } from '../../database/schema';
import { rejectsConstraint, withDatabaseFixture } from './database-fixtures';
import { insertAccount } from './account-fixtures';

test('security schema uses cascade for credentials and anonymizes retained audit records', async () => {
  expect(getTableConfig(accountSecurity).foreignKeys[0]?.onDelete).toBe('cascade');
  expect(getTableConfig(accountSecurity).foreignKeys[0]?.reference().foreignColumns[0]?.name).toBe(
    'id',
  );
  expect(getTableConfig(authAudit).foreignKeys[0]?.onDelete).toBe('set null');
  expect(getTableConfig(authAudit).foreignKeys[0]?.reference().foreignColumns[0]?.name).toBe('id');
  expect(getTableConfig(authAudit).indexes).toHaveLength(1);
  expect(getTableConfig(rewardPolicies).checks).toHaveLength(3);
  expect(getTableConfig(matchReceipts).foreignKeys).toHaveLength(0);
  await withDatabaseFixture(async (tx) => {
    const id = await insertAccount(tx);
    await rejectsConstraint(tx, 'account_security_recovery_hash', (sp) =>
      sp.insert(accountSecurity).values({ accountId: id, recoveryHash: 'usable-raw-code' }),
    );
    await rejectsConstraint(tx, 'auth_audit_event', (sp) =>
      sp.insert(authAudit).values({ event: 'secret arbitrary payload' }),
    );
    await rejectsConstraint(tx, 'reward_policies_values', (sp) =>
      sp.insert(rewardPolicies).values({
        version: 'bad-values',
        completionXp: -1n,
        victoryXp: 0n,
        competitiveVictoryPoints: 0n,
        xpPerLevel: 500n,
      }),
    );
    await rejectsConstraint(tx, 'reward_policies_version', (sp) =>
      sp.insert(rewardPolicies).values({
        version: "x'; --",
        completionXp: 100n,
        victoryXp: 50n,
        competitiveVictoryPoints: 10n,
        xpPerLevel: 500n,
      }),
    );
    await rejectsConstraint(tx, 'reward_policies_solo_xp', (sp) =>
      sp.insert(rewardPolicies).values({
        version: 'bad-solo',
        soloXpPercent: 100,
        completionXp: 100n,
        victoryXp: 50n,
        competitiveVictoryPoints: 10n,
        xpPerLevel: 500n,
      }),
    );
    await rejectsConstraint(tx, 'match_receipts_id', (sp) =>
      sp.insert(matchReceipts).values({ id: '' }),
    );
  });
});
