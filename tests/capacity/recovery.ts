import { SQL } from 'bun';
import { startServer } from '../../apps/server/src/bootstrap/runtime';
import { createRuntimePorts } from '../../apps/server/src/modules/rooms';
import { createPostgresResultWriter } from '../../apps/server/src/modules/progression/adapters/outbound/postgres-results';
import { createResultOutbox } from '../../apps/server/src/modules/progression/adapters/outbound/result-outbox';
import type { MatchRecord } from '../../apps/server/src/modules/progression/domain/match-record';
import { origin, room, until } from './client';

/** This is an adapter fixture, separate from the naturally completed network games. */
export async function recover(
  databaseUrl: string,
  source: string,
  pause: () => Promise<void>,
  resume: () => Promise<void>,
) {
  const control = new SQL(databaseUrl, { max: 1 });
  const writerClient = new SQL(databaseUrl, { max: 1, connectionTimeout: 1 });
  const cleanup: (() => void | Promise<void>)[] = [
    () => control.close(),
    () => writerClient.close(),
  ];
  let paused = false;
  let failure: unknown;
  let report:
    | {
        recoveryMs: number;
        outageMs: number;
        maximumOutbox: number;
        preservedRejectedSnapshot: boolean;
        rejectedEntropyDraws: number;
        rewardGrants: number;
        creditedXp: number;
        replayExtraXp: number;
      }
    | undefined;

  try {
    const participants = await control<{ seat: number; accountId: string }[]>`
    SELECT seat, account_id AS "accountId" FROM app.match_participants WHERE match_id = ${source} ORDER BY seat`;
    if (participants.length !== 2 || participants.some((entry) => !entry.accountId))
      throw new Error('CAPACITY_RECOVERY_PARTICIPANTS_MISSING');

    const total = async () => {
      const [row] = await control<
        { xp: string }[]
      >`SELECT coalesce(sum(xp), 0)::text AS xp FROM app.player_progress`;
      return BigInt(row?.xp ?? '0');
    };
    const initial = await total();
    let unavailable = false;
    const outbox = createResultOutbox(
      'm5-v2',
      createPostgresResultWriter(writerClient),
      {
        schedule(delay, callback) {
          const timer = setTimeout(callback, delay);
          return () => clearTimeout(timer);
        },
        report(code) {
          if (code === 'result_unavailable') unavailable = true;
        },
      },
      1,
    );
    cleanup.push(() => outbox.close());
    const ports = createRuntimePorts();
    let draws = 0;
    const runtime = startServer({
      port: 0,
      allowedOrigins: [origin],
      ports: {
        ...ports,
        results: outbox.writer,
        randomInt(maximum) {
          draws++;
          return ports.randomInt(maximum);
        },
      },
    });
    cleanup.push(() => runtime.stop());
    const game = await room(runtime.server.url.origin, 2, []);
    cleanup.push(() => game.close());
    const record: MatchRecord = {
      id: `capacity_recovery_${crypto.randomUUID()}`,
      preset: 'competitive',
      format: '1v1',
      solo: false,
      reason: 'completed',
      winner: 'A',
      scoreA: 12,
      scoreB: 0,
      handsPlayed: 1,
      powersUsed: 0,
      rewardPolicyVersion: 'm5-v2',
      startedAt: Date.now() - 1000,
      finishedAt: Date.now(),
      participants,
    };

    await game.ready();
    const before = JSON.stringify(game.view());
    const entropyBefore = draws;
    await pause();
    paused = true;
    const outageStarted = performance.now();
    outbox.writer.reserve(record.id);
    outbox.writer.write(record);
    await until(() => unavailable);
    if (outbox.size() !== 1) throw new Error('CAPACITY_OUTBOX_NOT_BOUNDED');
    const rejection = await game.act(0, { type: 'START_MATCH' }, true);
    if (rejection.type !== 'ERROR' || rejection.code !== 'PERSISTENCE_UNAVAILABLE')
      throw new Error('CAPACITY_REJECTION_REASON_INVALID');
    if (JSON.stringify(game.view()) !== before || draws !== entropyBefore)
      throw new Error('CAPACITY_REJECTION_MUTATED_STATE');

    const recoveryStarted = performance.now();
    await resume();
    paused = false;
    const outageMs = performance.now() - outageStarted;
    await until(async () => {
      await outbox.flush();
      return outbox.size() === 0 && (await total()) === initial + 250n;
    });
    const recoveryMs = performance.now() - recoveryStarted;
    outbox.writer.reserve(record.id);
    outbox.writer.write(record);
    await outbox.flush();
    if ((await total()) !== initial + 250n) throw new Error('CAPACITY_DUPLICATE_REWARD');
    const [grants] = await control<{ count: number }[]>`SELECT count(*)::int AS count
      FROM app.match_rewards r JOIN app.match_participants p ON p.id = r.participant_id WHERE p.match_id = ${record.id}`;
    if (grants?.count !== 2) throw new Error('CAPACITY_REWARD_COUNT_INVALID');
    await game.act(0, { type: 'START_MATCH' });

    report = {
      recoveryMs,
      outageMs,
      maximumOutbox: 1,
      preservedRejectedSnapshot: true,
      rejectedEntropyDraws: 0,
      rewardGrants: 2,
      creditedXp: 250,
      replayExtraXp: 0,
    };
  } catch (cause) {
    failure = cause;
  } finally {
    if (paused) {
      try {
        await resume();
      } catch {
        failure ??= new Error('CAPACITY_DATABASE_RESUME_FAILED');
      }
    }
    let failed = false;
    for (const release of cleanup.toReversed()) {
      try {
        await release();
      } catch {
        failed = true;
      }
    }
    if (failed) failure ??= new Error('CAPACITY_RECOVERY_CLEANUP_FAILED');
  }

  if (failure !== undefined) throw failure;
  if (!report) throw new Error('CAPACITY_RECOVERY_INCOMPLETE');

  return report;
}
