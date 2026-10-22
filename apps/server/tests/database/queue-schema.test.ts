import { expect, test } from 'bun:test';
import { SQL } from 'bun';
import { eq, sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { connectLocalDatabase } from '../../database/connect';
import { jobs, matchResults } from '../../database/schema';
import { localDatabaseUrl } from '../../database/target';
import { ensureDatabaseSchema, rejectsConstraint, withDatabaseFixture } from './database-fixtures';
import { resultValues } from './match-fixtures';

test('queue schema has targeted indexes, typed result references and no secret payload', () => {
  const config = getTableConfig(jobs);
  expect(config.indexes.map((index) => index.config.name)).toEqual([
    'jobs_pending_idx',
    'jobs_running_lease_idx',
    'jobs_terminal_idx',
  ]);
  expect(config.foreignKeys).toHaveLength(1);
  expect(config.columns.some((column) => column.dataType === 'json')).toBe(false);
});

test('jobs enforce idempotency, bounded retries, lease states and safe error codes', () =>
  withDatabaseFixture(async (tx) => {
    const result = resultValues();
    await tx.insert(matchResults).values(result);
    const value = { matchId: result.id, kind: 'match_rewards' as const };
    const [job] = await tx.insert(jobs).values(value).returning();
    expect(job).toMatchObject({
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      lockToken: null,
      finishedAt: null,
    });
    await rejectsConstraint(tx, 'jobs_match_kind_unique', (sp) => sp.insert(jobs).values(value));
    await rejectsConstraint(tx, 'jobs_match_id_match_results_id_fk', (sp) =>
      sp.insert(jobs).values({ ...value, matchId: 'missing' }),
    );
    await rejectsConstraint(tx, 'jobs_attempts', (sp) =>
      sp.update(jobs).set({ attempts: -1 }).where(eq(jobs.matchId, result.id)),
    );
    await rejectsConstraint(tx, 'jobs_attempts', (sp) =>
      sp.update(jobs).set({ maxAttempts: 101 }).where(eq(jobs.matchId, result.id)),
    );
    await rejectsConstraint(tx, 'jobs_pending_attempts', (sp) =>
      sp.update(jobs).set({ attempts: 5 }).where(eq(jobs.matchId, result.id)),
    );
    await rejectsConstraint(tx, 'jobs_lease', (sp) =>
      sp.update(jobs).set({ status: 'running', attempts: 1 }).where(eq(jobs.matchId, result.id)),
    );
    await rejectsConstraint(tx, 'jobs_finished', (sp) =>
      sp.update(jobs).set({ status: 'completed' }).where(eq(jobs.matchId, result.id)),
    );
    await rejectsConstraint(tx, 'jobs_error_code', (sp) =>
      sp.update(jobs).set({ lastErrorCode: 'password=secret' }).where(eq(jobs.matchId, result.id)),
    );

    await tx
      .update(jobs)
      .set({
        status: 'running',
        attempts: 1,
        lockToken: crypto.randomUUID(),
        leaseExpiresAt: new Date(Date.now() + 60_000),
      })
      .where(eq(jobs.matchId, result.id));
    await tx
      .update(jobs)
      .set({
        status: 'pending',
        lockToken: null,
        leaseExpiresAt: null,
        lastErrorCode: 'DB_UNAVAILABLE',
        runAt: new Date(Date.now() + 10_000),
      })
      .where(eq(jobs.matchId, result.id));
    await tx
      .update(jobs)
      .set({ status: 'completed', finishedAt: new Date(Date.now() + 1_000) })
      .where(eq(jobs.matchId, result.id));
    expect((await tx.select().from(jobs).where(eq(jobs.matchId, result.id)))[0]?.status).toBe(
      'completed',
    );
  }));

test('NOTIFY wakes only after commit, rollback is silent, and a missed wake leaves durable work', async () => {
  await ensureDatabaseSchema();
  const writer = connectLocalDatabase('test');
  const listener = new SQL(localDatabaseUrl('test'), { max: 1 });
  const received: string[] = [];
  let ready = Promise.withResolvers<void>();
  let barrier = Promise.withResolvers<void>();
  const barrierChannel = `fixture_${crypto.randomUUID().replaceAll('-', '')}`;
  const result = resultValues();
  const rollbackResult = resultValues();
  const missedResult = resultValues();
  const subscription = await listener.listen('truco_jobs_ready', (payload) => {
    received.push(payload);
    ready.resolve();
  });
  const checkpoint = await listener.listen(barrierChannel, () => barrier.resolve());
  const rollback = new Error('intentional rollback');

  try {
    await writer.db.transaction(async (tx) => {
      await tx.insert(matchResults).values(result);
      await tx.insert(jobs).values({ matchId: result.id, kind: 'match_rewards' });
      await listener.notify(barrierChannel);
      await barrier.promise;
      expect(received).toEqual([]);
    });
    await ready.promise;
    expect(received).toEqual(['']);

    await expect(
      writer.db.transaction(async (tx) => {
        await tx.insert(matchResults).values(rollbackResult);
        await tx.insert(jobs).values({ matchId: rollbackResult.id, kind: 'match_rewards' });
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    barrier = Promise.withResolvers<void>();
    await writer.db.execute(sql`SELECT pg_notify(${barrierChannel}, '')`);
    await barrier.promise;
    expect(received).toEqual(['']);
    expect(await writer.db.select().from(jobs).where(eq(jobs.matchId, rollbackResult.id))).toEqual(
      [],
    );
    expect(
      await writer.db.select().from(matchResults).where(eq(matchResults.id, rollbackResult.id)),
    ).toEqual([]);

    ready = Promise.withResolvers<void>();
    await writer.db
      .update(jobs)
      .set({ runAt: new Date(Date.now() + 10_000) })
      .where(eq(jobs.matchId, result.id));
    await ready.promise;
    expect(received).toEqual(['', '']);

    await writer.db
      .update(jobs)
      .set({ status: 'completed', finishedAt: new Date(Date.now() + 1_000) })
      .where(eq(jobs.matchId, result.id));
    barrier = Promise.withResolvers<void>();
    await writer.db.execute(sql`SELECT pg_notify(${barrierChannel}, '')`);
    await barrier.promise;
    expect(received).toEqual(['', '']);

    await subscription.unlisten();
    await writer.db.transaction(async (tx) => {
      await tx.insert(matchResults).values(missedResult);
      await tx.insert(jobs).values({ matchId: missedResult.id, kind: 'match_rewards' });
    });
    expect(
      await writer.db.select().from(jobs).where(eq(jobs.matchId, missedResult.id)),
    ).toHaveLength(1);
    expect(received).toEqual(['', '']);
  } finally {
    await checkpoint.unlisten();
    await subscription.unlisten();
    for (const id of [result.id, rollbackResult.id, missedResult.id]) {
      await writer.db.delete(matchResults).where(eq(matchResults.id, id));
    }
    await listener.close();
    await writer.close();
  }
}, 10_000);

test('two real PostgreSQL consumers skip a reserved row and rollback releases it', async () => {
  await ensureDatabaseSchema();
  const fixture = connectLocalDatabase('test');
  const consumers = new SQL(localDatabaseUrl('test'), { max: 2, connectionTimeout: 3 });
  const first = resultValues();
  const second = resultValues();
  const rollback = new Error('consumer rollback');

  try {
    await fixture.db.transaction(async (tx) => {
      await tx.insert(matchResults).values([first, second]);
      await tx.insert(jobs).values([
        { matchId: first.id, kind: 'match_rewards', runAt: new Date('2026-01-01') },
        { matchId: second.id, kind: 'match_rewards', runAt: new Date('2026-01-02') },
      ]);
    });

    await expect(
      consumers.begin(async (a) => {
        const locked = await a<
          { match_id: string }[]
        >`SELECT match_id FROM app.jobs WHERE match_id IN (${first.id}, ${second.id}) AND status = 'pending' ORDER BY run_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`;
        expect(locked[0]?.match_id).toBe(first.id);
        await consumers.begin(async (b) => {
          const other = await b<
            { match_id: string }[]
          >`SELECT match_id FROM app.jobs WHERE match_id IN (${first.id}, ${second.id}) AND status = 'pending' ORDER BY run_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`;
          expect(other[0]?.match_id).toBe(second.id);
          await b`UPDATE app.jobs SET status = 'completed', finished_at = clock_timestamp() WHERE match_id = ${second.id}`;
        });
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    await consumers.begin(async (tx) => {
      const recovered = await tx<
        { match_id: string }[]
      >`SELECT match_id FROM app.jobs WHERE match_id IN (${first.id}, ${second.id}) AND status = 'pending' ORDER BY run_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`;
      expect(recovered[0]?.match_id).toBe(first.id);
    });
  } finally {
    for (const id of [first.id, second.id])
      await fixture.db.delete(matchResults).where(eq(matchResults.id, id));
    await consumers.close();
    await fixture.close();
  }
}, 10_000);
