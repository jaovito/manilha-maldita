import { SQL } from 'bun';
import { connectLocalDatabase } from '../../database/connect';
import { cosmeticCatalogSeed } from '../../database/seeds/catalogs';
import { runSeeds } from '../../database/seeds/run';
import { localDatabaseUrl } from '../../database/target';
import { createPostgresAccountMaintenance } from '../../src/modules/accounts/adapters/outbound/postgres-account-maintenance';
import { PostgresJobQueue } from '../../src/modules/jobs/adapters/outbound/postgres-queue';
import { createPostgresPlayers } from '../../src/modules/progression/adapters/outbound/postgres-players';
import { createPostgresResultWriter } from '../../src/modules/progression/adapters/outbound/postgres-results';
import {
  ensureRewardPolicy,
  grantMatchRewards,
} from '../../src/modules/progression/adapters/outbound/postgres-rewards';
import { ensureDatabaseSchema } from './database-fixtures';

export const rewardPolicy = {
  version: 'progression-fixture-v2',
  completionXp: 100n,
  soloXpPercent: 50,
  victoryXp: 50n,
  competitiveVictoryPoints: 10n,
  xpPerLevel: 500n,
};
export async function withProgressionFixture(
  run: (fixture: {
    client: SQL;
    accounts: string[];
    matches: string[];
    players: ReturnType<typeof createPostgresPlayers>;
    persist: ReturnType<typeof createPostgresResultWriter>;
    queue: PostgresJobQueue;
    maintenance: ReturnType<typeof createPostgresAccountMaintenance>;
  }) => Promise<void>,
) {
  await ensureDatabaseSchema();
  const connection = connectLocalDatabase('test');
  await runSeeds(connection.db, [cosmeticCatalogSeed]);
  await runSeeds(connection.db, [cosmeticCatalogSeed]);
  await connection.close();
  const client = new SQL(localDatabaseUrl('test'), { max: 6 });
  const accounts: string[] = [];
  const matches: string[] = [];

  try {
    await ensureRewardPolicy(client, rewardPolicy);
    for (let seat = 0; seat < 4; seat++) {
      const id = crypto.randomUUID();
      accounts.push(id);
      await client`INSERT INTO app.accounts (id, login_name, password_hash) VALUES (${id}, ${`p_${id.replaceAll('-', '').slice(0, 24)}`}, '$argon2id$v=19$m=19456,t=2,p=1$YWJj$YWJj')`;
      await client`INSERT INTO app.profiles (account_id, nickname) VALUES (${id}, ${`Player ${seat}`})`;
      await client`INSERT INTO app.player_progress (account_id) VALUES (${id})`;
    }

    await run({
      client,
      accounts,
      matches,
      players: createPostgresPlayers(client, 500n),
      persist: createPostgresResultWriter(client),
      queue: new PostgresJobQueue(client, grantMatchRewards),
      maintenance: createPostgresAccountMaintenance(client),
    });
  } finally {
    for (const id of matches) {
      await client`DELETE FROM app.match_results WHERE id = ${id}`;
      await client`DELETE FROM app.match_receipts WHERE id = ${id}`;
    }
    for (const id of accounts) await client`DELETE FROM app.accounts WHERE id = ${id}`;
    await client.close();
  }
}
