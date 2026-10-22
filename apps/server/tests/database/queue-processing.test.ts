import { expect, test } from 'bun:test';
import { PostgresJobQueue } from '../../src/modules/jobs/adapters/outbound/postgres-queue';
import { withQueueFixture } from './queue-fixtures';

test('queue insertion is transactional and duplicate enqueue does not reset completed work or retry limits', () =>
  withQueueFixture(async (fixture) => {
    const { client, accountId } = fixture;
    const queue = new PostgresJobQueue(client, async (tx) => {
      await tx`UPDATE app.player_progress SET xp = xp + 10 WHERE account_id = ${accountId}`;
    });
    const id = await fixture.enqueue(queue);
    await client.begin((tx) => queue.enqueue(tx, id, 1));
    expect(await queue.runNext()).toBe('completed');
    await client.begin((tx) => queue.enqueue(tx, id));
    expect(await queue.runNext()).toBe('idle');
    const [job] =
      await client`SELECT status, attempts, max_attempts, last_error_code FROM app.jobs WHERE match_id = ${id}`;
    expect(job).toMatchObject({
      status: 'completed',
      attempts: 1,
      max_attempts: 5,
      last_error_code: null,
    });
    const [progress] =
      await client`SELECT xp::text FROM app.player_progress WHERE account_id = ${accountId}`;
    expect(progress?.xp).toBe('10');

    let rollbackId = '';
    await expect(
      client.begin(async (tx) => {
        rollbackId = await fixture.insertResult(tx);
        await queue.enqueue(tx, rollbackId);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await client`SELECT id FROM app.match_results WHERE id = ${rollbackId}`).toHaveLength(0);
    expect(await client`SELECT id FROM app.jobs WHERE match_id = ${rollbackId}`).toHaveLength(0);
  }));

test('processor failure rolls back SQL effects, backs off, and fails permanently at the retry limit', () =>
  withQueueFixture(async (fixture) => {
    const { client, accountId } = fixture;
    let calls = 0;
    const queue = new PostgresJobQueue(client, async (tx) => {
      calls++;
      await tx`UPDATE app.player_progress SET xp = xp + 10 WHERE account_id = ${accountId}`;
      throw new Error('sensitive credential must not be persisted');
    });
    const id = await fixture.enqueue(queue, 2);
    expect(await queue.runNext()).toBe('retry');
    const [retried] = await client`SELECT status, attempts, last_error_code,
    run_at > clock_timestamp() AS delayed, lock_token, lease_expires_at FROM app.jobs WHERE match_id = ${id}`;
    expect(retried).toMatchObject({
      status: 'pending',
      attempts: 1,
      last_error_code: 'JOB_PROCESSING_FAILED',
      delayed: true,
      lock_token: null,
      lease_expires_at: null,
    });
    expect(await queue.runNext()).toBe('idle');
    expect(calls).toBe(1);

    await client`UPDATE app.jobs SET run_at = clock_timestamp() - interval '1 second' WHERE match_id = ${id}`;
    expect(await queue.runNext()).toBe('failed');
    expect(await queue.runNext()).toBe('idle');
    const [failed] =
      await client`SELECT status, attempts, finished_at IS NOT NULL AS finished FROM app.jobs WHERE match_id = ${id}`;
    expect(failed).toMatchObject({ status: 'failed', attempts: 2, finished: true });
    const [progress] =
      await client`SELECT xp::text FROM app.player_progress WHERE account_id = ${accountId}`;
    expect(progress?.xp).toBe('0');
  }));

test('a database error inside the savepoint does not abort retry registration and a later attempt commits once', () =>
  withQueueFixture(async (fixture) => {
    const { client, accountId } = fixture;
    const queue = new PostgresJobQueue(client, async (tx, job) => {
      await tx`UPDATE app.player_progress SET xp = xp + 7 WHERE account_id = ${accountId}`;
      if (job.attempt === 1)
        await tx`INSERT INTO app.player_progress (account_id) VALUES (${accountId})`;
    });
    const id = await fixture.enqueue(queue);
    expect(await queue.runNext()).toBe('retry');
    await client`UPDATE app.jobs SET run_at = clock_timestamp() - interval '1 second' WHERE match_id = ${id}`;
    expect(await queue.runNext()).toBe('completed');
    const [progress] =
      await client`SELECT xp::text FROM app.player_progress WHERE account_id = ${accountId}`;
    expect(progress?.xp).toBe('7');
  }));

test('configuration and enqueue validation fail before writing anything', () =>
  withQueueFixture(async (fixture) => {
    const { client } = fixture;
    const queue = new PostgresJobQueue(client, async () => {});
    expect(
      () => new PostgresJobQueue(client, async () => {}, { baseDelayMs: 0, maxDelayMs: 1 }),
    ).toThrow('INVALID_RETRY_POLICY');
    for (const [id, maxAttempts] of [
      [' ', 5],
      ['x'.repeat(129), 5],
      ['valid', 0],
      ['valid', 101],
      ['valid', 1.5],
    ] as const) {
      await expect(client.begin((tx) => queue.enqueue(tx, id, maxAttempts))).rejects.toThrow(
        'INVALID_JOB_REFERENCE',
      );
    }
    expect(await queue.runNext()).toBe('idle');
    await expect(client.begin((tx) => queue.enqueue(tx, 'missing-result'))).rejects.toThrow();
  }));
