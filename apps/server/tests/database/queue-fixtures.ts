import { SQL, type TransactionSQL } from 'bun';
import { localDatabaseUrl } from '../../database/target';
import type { PostgresJobQueue } from '../../src/modules/jobs/adapters/outbound/postgres-queue';
import { fixturePasswordHash } from './account-fixtures';
import { ensureDatabaseSchema } from './database-fixtures';
import { resultValues } from './match-fixtures';

export type QueueFixture = {
  client: SQL;
  accountId: string;
  insertResult(tx: TransactionSQL, id?: string): Promise<string>;
  enqueue(queue: PostgresJobQueue, maxAttempts?: number): Promise<string>;
};

export async function withQueueFixture(run: (fixture: QueueFixture) => Promise<void>) {
  await ensureDatabaseSchema();
  const client = new SQL(localDatabaseUrl('test'), { max: 4, connectionTimeout: 3 });
  const accountId = crypto.randomUUID();
  const results: string[] = [];
  const fixture: QueueFixture = {
    client,
    accountId,
    async insertResult(tx, id) {
      const result = resultValues(id);
      results.push(result.id);
      await tx`INSERT INTO app.match_results (id, preset, format, solo, reason, winner,
        score_a, score_b, hands_played, powers_used, reward_policy_version, started_at, finished_at)
        VALUES (${result.id}, 'competitive', '1v1', false, 'completed', 'A', 12, 8, 7, 6,
          'fixture-v1', ${result.startedAt}, ${result.finishedAt})`;

      return result.id;
    },
    enqueue(queue, maxAttempts) {
      return client.begin(async (tx) => {
        const id = await fixture.insertResult(tx);
        await queue.enqueue(tx, id, maxAttempts);
        return id;
      });
    },
  };

  try {
    await client`INSERT INTO app.accounts (id, login_name, password_hash)
      VALUES (${accountId}, ${`u_${accountId.replaceAll('-', '').slice(0, 24)}`}, ${fixturePasswordHash})`;
    await client`INSERT INTO app.player_progress (account_id) VALUES (${accountId})`;
    await run(fixture);
  } finally {
    try {
      for (const id of results) await client`DELETE FROM app.match_results WHERE id = ${id}`;
      await client`DELETE FROM app.accounts WHERE id = ${accountId}`;
    } finally {
      await client.close();
    }
  }
}
