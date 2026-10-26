import type { SavepointSQL, SQL, TransactionSQL } from 'bun';
import type { JobOutcome, JobQueue } from '../../application/ports/queue';
import {
  DEFAULT_RETRY_POLICY,
  type RetryPolicy,
  retryDelay,
  validateRetryPolicy,
} from '../../domain/retry-policy';

export type QueuedJob = Readonly<{
  id: string;
  kind: 'match_rewards';
  matchId: string;
  attempt: number;
}>;

/** Trusted SQL-only processor: all effects must use this savepoint, never external I/O. */
export type PostgresJobProcessor = (transaction: SavepointSQL, job: QueuedJob) => Promise<void>;

type JobRow = {
  id: string;
  kind: 'match_rewards';
  match_id: string;
  attempts: number;
  max_attempts: number;
};

export class PostgresJobQueue implements JobQueue {
  private readonly retry: RetryPolicy;

  constructor(
    private readonly client: SQL,
    private readonly process: PostgresJobProcessor,
    retry: RetryPolicy = DEFAULT_RETRY_POLICY,
  ) {
    validateRetryPolicy(retry);
    this.retry = { ...retry };
  }

  /** Caller must insert the authoritative result in this same transaction before enqueueing. */
  async enqueue(
    transaction: TransactionSQL,
    matchId: unknown,
    maxAttempts: unknown = 5,
  ): Promise<void> {
    if (
      typeof matchId !== 'string' ||
      matchId.length < 1 ||
      matchId.length > 80 ||
      /[^A-Za-z0-9_-]/.test(matchId) ||
      typeof maxAttempts !== 'number' ||
      !Number.isInteger(maxAttempts) ||
      maxAttempts < 1 ||
      maxAttempts > 100
    )
      throw new Error('INVALID_JOB_REFERENCE');

    // This SQL tag binds values as parameters. An ordinary interpolated string would not.
    await transaction`INSERT INTO app.jobs (kind, match_id, max_attempts)
      VALUES ('match_rewards', ${matchId}, ${maxAttempts})
      ON CONFLICT (match_id, kind) DO NOTHING`;
  }

  async subscribe(wake: () => void): Promise<() => Promise<void>> {
    // Bun.SQL reserves its own dedicated listener connection, including reconnect catch-up.
    const subscription = await this.client.listen('truco_jobs_ready', () => wake(), wake);

    return () => subscription.unlisten();
  }

  async runNext(): Promise<JobOutcome> {
    return this.client.begin(async (tx) => {
      await tx`SELECT set_config('statement_timeout', '5000', true),
        set_config('idle_in_transaction_session_timeout', '5000', true)`;

      const [row] = await tx<JobRow[]>`
        SELECT id, kind, match_id, attempts, max_attempts FROM app.jobs
        WHERE (status = 'pending' AND run_at <= statement_timestamp())
          OR (status = 'running' AND lease_expires_at <= statement_timestamp())
        ORDER BY run_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`;

      if (!row) return 'idle';

      if (row.attempts >= row.max_attempts) {
        await tx`UPDATE app.jobs SET status = 'failed', lock_token = NULL, lease_expires_at = NULL,
          finished_at = clock_timestamp(), last_error_code = 'LEASE_EXPIRED' WHERE id = ${row.id}`;

        return 'failed';
      }

      const attempt = row.attempts + 1;
      await tx`UPDATE app.jobs SET status = 'running', attempts = ${attempt},
        lock_token = gen_random_uuid(), lease_expires_at = clock_timestamp() + interval '5 seconds'
        WHERE id = ${row.id}`;

      try {
        await tx.savepoint(async (savepoint) => {
          await this.process(savepoint, {
            id: row.id,
            kind: row.kind,
            matchId: row.match_id,
            attempt,
          });
        });
      } catch {
        const failed = attempt >= row.max_attempts;
        const delay = retryDelay(attempt, this.retry);
        await tx`UPDATE app.jobs SET status = ${failed ? 'failed' : 'pending'}::app.job_status,
          lock_token = NULL, lease_expires_at = NULL,
          finished_at = CASE WHEN ${failed} THEN clock_timestamp() ELSE NULL END,
          run_at = clock_timestamp() + ${delay} * interval '1 millisecond',
          last_error_code = 'JOB_PROCESSING_FAILED' WHERE id = ${row.id}`;

        return failed ? 'failed' : 'retry';
      }

      await tx`UPDATE app.jobs SET status = 'completed', lock_token = NULL, lease_expires_at = NULL,
        finished_at = clock_timestamp(), last_error_code = NULL WHERE id = ${row.id}`;

      return 'completed';
    });
  }
}
