import { expect, test } from 'bun:test';
import {
  maintainDatabase,
  startDatabaseMaintenance,
} from '../../src/bootstrap/database-maintenance';
import { rewardPolicy, withProgressionFixture } from './progression-fixture';

test('bounded retention removes expired personal records and old finished work while preserving active results and replay receipts', async () => {
  await withProgressionFixture(async ({ client, accounts, matches, persist, maintenance }) => {
    const accountId = accounts[0];
    await maintenance.audit('login_success', accountId);
    await client`UPDATE app.auth_audit SET occurred_at = statement_timestamp() - interval '8 days' WHERE account_id = ${accountId}`;
    const tokenHash =
      crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    await client`INSERT INTO app.sessions (account_id, token_hash, created_at, expires_at) VALUES (${accountId}, ${tokenHash}, statement_timestamp() - interval '4 days', statement_timestamp() - interval '3 days')`;
    for (const pending of [false, true]) {
      const id = crypto.randomUUID();
      matches.push(id);
      await persist({
        id,
        preset: 'casual',
        format: '1v1',
        solo: false,
        reason: 'completed',
        winner: 'A',
        scoreA: 12,
        scoreB: 8,
        handsPlayed: 1,
        powersUsed: 0,
        rewardPolicyVersion: rewardPolicy.version,
        startedAt: Date.now() - 92 * 86400000,
        finishedAt: Date.now() - 91 * 86400000,
        participants: [
          { seat: 0, accountId: accountId ?? null },
          { seat: 1, accountId: null },
        ],
      });
      if (!pending)
        await client`UPDATE app.jobs SET created_at = statement_timestamp() - interval '9 days', status = 'completed', finished_at = statement_timestamp() - interval '8 days' WHERE match_id = ${id}`;
    }
    await maintainDatabase(client);
    expect(await client`SELECT id FROM app.sessions WHERE token_hash = ${tokenHash}`).toHaveLength(
      0,
    );
    expect(
      await client`SELECT id FROM app.auth_audit WHERE account_id = ${accountId}`,
    ).toHaveLength(0);
    expect(await client`SELECT id FROM app.match_results WHERE id = ${matches[0]}`).toHaveLength(0);
    expect(await client`SELECT id FROM app.match_results WHERE id = ${matches[1]}`).toHaveLength(1);
    expect(await client`SELECT id FROM app.match_receipts WHERE id = ${matches[0]}`).toHaveLength(
      1,
    );
    let scheduled: (() => void) | undefined;
    let delivered: ((healthy: boolean) => void) | undefined;
    const completed = new Promise<boolean>((resolve) => {
      delivered = resolve;
    });
    const stop = startDatabaseMaintenance(
      client,
      1000,
      (healthy) => delivered?.(healthy),
      (_delay, callback) => {
        scheduled = callback;
        return () => {
          scheduled = undefined;
        };
      },
    );
    scheduled?.();
    expect(await completed).toBe(true);
    await stop();
    expect(scheduled).toBeUndefined();
  });
});
