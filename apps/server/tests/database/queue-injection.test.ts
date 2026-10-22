import { expect, test } from 'bun:test';
import { PostgresJobQueue } from '../../src/modules/jobs/adapters/outbound/postgres-queue';
import { withQueueFixture } from './queue-fixtures';

test('queue references reject malformed runtime values and SQL syntax before inserting jobs', () =>
  withQueueFixture(async (fixture) => {
    const { client } = fixture;
    const queue = new PostgresJobQueue(client, async () => {});
    const matchId = await client.begin((tx) => fixture.insertResult(tx));
    const invalidIds: unknown[] = [
      null,
      undefined,
      false,
      123,
      {},
      [],
      { matchId },
      '',
      ' ',
      'x'.repeat(81),
      `${matchId}\n`,
      `${matchId}\0`,
      "' OR 1=1 --",
      `${matchId}'; SELECT 1; --`,
      'x/*comment*/',
    ];
    for (const invalid of invalidIds) {
      await expect(client.begin((tx) => queue.enqueue(tx, invalid))).rejects.toThrow(
        'INVALID_JOB_REFERENCE',
      );
    }

    const invalidLimits: unknown[] = [
      null,
      '5',
      '1; SELECT 1',
      true,
      [],
      {},
      Number.NaN,
      Number.POSITIVE_INFINITY,
      0,
      101,
      1.5,
    ];
    for (const invalid of invalidLimits) {
      await expect(client.begin((tx) => queue.enqueue(tx, matchId, invalid))).rejects.toThrow(
        'INVALID_JOB_REFERENCE',
      );
    }

    expect(await client`SELECT id FROM app.jobs WHERE match_id = ${matchId}`).toHaveLength(0);
    expect(await client`SELECT id FROM app.match_results WHERE id = ${matchId}`).toHaveLength(1);
    await client.begin((tx) => queue.enqueue(tx, matchId));
    expect(await queue.runNext()).toBe('completed');
  }));

test('valid opaque IDs at protocol boundaries are accepted without SQL keyword blacklists', () =>
  withQueueFixture(async (fixture) => {
    const { client } = fixture;
    const seen: string[] = [];
    const queue = new PostgresJobQueue(client, async (_tx, job) => {
      seen.push(job.matchId);
    });
    for (const id of ['x', 'SELECT', 'valid-id_123', 'x'.repeat(80)]) {
      await client.begin(async (tx) => {
        await fixture.insertResult(tx, id);
        await queue.enqueue(tx, id, 1);
      });
      expect(await queue.runNext()).toBe('completed');
      expect(seen.at(-1)).toBe(id);
    }
  }));

test('SQL-looking persisted values stay literal through selection, processing and updates', () =>
  withQueueFixture(async (fixture) => {
    const { client, accountId } = fixture;
    const maliciousId = "fixture' OR '1'='1'; SELECT 1; --";
    let ordinaryId = '';
    // Deliberately bypass the producer's ID validation to exercise second-order parameterization.
    await client.begin(async (tx) => {
      ordinaryId = await fixture.insertResult(tx);
      await fixture.insertResult(tx, maliciousId);
      await tx`INSERT INTO app.jobs (kind, match_id) VALUES ('match_rewards', ${maliciousId})`;
    });
    const seen: string[] = [];
    const queue = new PostgresJobQueue(client, async (tx, job) => {
      seen.push(job.matchId);
      await tx`UPDATE app.match_results SET powers_used = powers_used + 1 WHERE id = ${job.matchId}`;
      await tx`UPDATE app.player_progress SET xp = xp + 1 WHERE account_id = ${accountId}`;
    });

    expect(await queue.runNext()).toBe('completed');
    expect(await queue.runNext()).toBe('idle');
    expect(seen).toEqual([maliciousId]);
    const [ordinary] =
      await client`SELECT powers_used FROM app.match_results WHERE id = ${ordinaryId}`;
    const [literal] =
      await client`SELECT id, powers_used FROM app.match_results WHERE id = ${maliciousId}`;
    const [job] = await client`SELECT status FROM app.jobs WHERE match_id = ${maliciousId}`;
    const [progress] =
      await client`SELECT xp::text FROM app.player_progress WHERE account_id = ${accountId}`;
    expect(ordinary?.powers_used).toBe(6);
    expect(literal).toMatchObject({ id: maliciousId, powers_used: 7 });
    expect(job?.status).toBe('completed');
    expect(progress?.xp).toBe('1');
  }));
