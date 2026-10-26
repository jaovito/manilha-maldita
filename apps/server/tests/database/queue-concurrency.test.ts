import { expect, test } from 'bun:test';
import { PostgresJobQueue } from '../../src/modules/jobs/adapters/outbound/postgres-queue';
import { withQueueFixture } from './queue-fixtures';

test('concurrent consumers skip a processing job and commit each effect exactly once', () =>
  withQueueFixture(async (fixture) => {
    const { client, accountId } = fixture;
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const calls: string[] = [];
    let first = '';
    const queue = new PostgresJobQueue(client, async (tx, job) => {
      calls.push(job.matchId);
      if (job.matchId === first) {
        entered.resolve();
        await release.promise;
      }
      await tx`UPDATE app.player_progress SET xp = xp + 1 WHERE account_id = ${accountId}`;
    });
    first = await fixture.enqueue(queue);
    const processing = queue.runNext();
    await entered.promise;

    try {
      expect(await queue.runNext()).toBe('idle');
      const second = await fixture.enqueue(queue);
      expect(await queue.runNext()).toBe('completed');
      expect(calls).toEqual([first, second]);
    } finally {
      release.resolve();
    }

    expect(await processing).toBe('completed');
    const [progress] =
      await client`SELECT xp::text FROM app.player_progress WHERE account_id = ${accountId}`;
    expect(progress?.xp).toBe('2');
    expect(await queue.runNext()).toBe('idle');
  }));

test('future jobs and live reservations wait; expired reservations recover or exhaust attempts', () =>
  withQueueFixture(async (fixture) => {
    const { client } = fixture;
    const seen: number[] = [];
    const queue = new PostgresJobQueue(client, async (_tx, job) => {
      seen.push(job.attempt);
    });
    const id = await fixture.enqueue(queue, 2);
    await client`UPDATE app.jobs SET run_at = clock_timestamp() + interval '1 hour' WHERE match_id = ${id}`;
    expect(await queue.runNext()).toBe('idle');

    await client`UPDATE app.jobs SET status = 'running', attempts = 1, lock_token = gen_random_uuid(),
    lease_expires_at = clock_timestamp() + interval '1 hour' WHERE match_id = ${id}`;
    expect(await queue.runNext()).toBe('idle');
    await client`UPDATE app.jobs SET created_at = clock_timestamp() - interval '1 hour',
    lease_expires_at = clock_timestamp() - interval '1 second' WHERE match_id = ${id}`;
    expect(await queue.runNext()).toBe('completed');
    expect(seen).toEqual([2]);

    const exhausted = await fixture.enqueue(queue, 1);
    await client`UPDATE app.jobs SET status = 'running', attempts = 1,
    created_at = clock_timestamp() - interval '1 hour', lock_token = gen_random_uuid(),
    lease_expires_at = clock_timestamp() - interval '1 second' WHERE match_id = ${exhausted}`;
    expect(await queue.runNext()).toBe('failed');
    expect(seen).toEqual([2]);
    const [job] =
      await client`SELECT attempts, status, last_error_code FROM app.jobs WHERE match_id = ${exhausted}`;
    expect(job).toMatchObject({ attempts: 1, status: 'failed', last_error_code: 'LEASE_EXPIRED' });
  }));

test('lost processing connection rolls back job and effects for another consumer to recover', () =>
  withQueueFixture(async (fixture) => {
    const { client, accountId } = fixture;
    const entered = Promise.withResolvers<number>();
    const release = Promise.withResolvers<void>();
    const queue = new PostgresJobQueue(client, async (tx) => {
      await tx`UPDATE app.player_progress SET xp = xp + 100 WHERE account_id = ${accountId}`;
      const [backend] = await tx<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      if (!backend) throw new Error('MISSING_BACKEND');
      entered.resolve(backend.pid);
      await release.promise;
      await tx`SELECT 1`;
    });
    const id = await fixture.enqueue(queue);
    const processing = queue.runNext();
    const pid = await entered.promise;

    try {
      await client`SELECT pg_terminate_backend(${pid})`;
    } finally {
      release.resolve();
    }
    await expect(processing).rejects.toThrow();
    const [restored] = await client`SELECT status, attempts FROM app.jobs WHERE match_id = ${id}`;
    expect(restored).toMatchObject({ status: 'pending', attempts: 0 });
    const successor = new PostgresJobQueue(client, async (tx) => {
      await tx`UPDATE app.player_progress SET xp = xp + 1 WHERE account_id = ${accountId}`;
    });
    expect(await successor.runNext()).toBe('completed');
    const [progress] =
      await client`SELECT xp::text FROM app.player_progress WHERE account_id = ${accountId}`;
    expect(progress?.xp).toBe('1');
  }));

test('subscription uses notifications only as wakes and can unsubscribe cleanly', () =>
  withQueueFixture(async (fixture) => {
    const { client } = fixture;
    const queue = new PostgresJobQueue(client, async () => {});
    let called = 0;
    let gate = Promise.withResolvers<void>();
    const unsubscribe = await queue.subscribe(() => {
      called++;
      gate.resolve();
    });

    try {
      await gate.promise;
      expect(called).toBeGreaterThan(0);
      const initial = called;
      gate = Promise.withResolvers<void>();
      await client.notify('truco_jobs_ready', 'untrusted wake payload');
      await gate.promise;
      expect(called).toBe(initial + 1);
    } finally {
      await unsubscribe();
    }
  }));
