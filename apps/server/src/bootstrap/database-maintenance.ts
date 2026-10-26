import type { SQL } from 'bun';

/** Bounded batches; active and failed result work must remain available for recovery. */
export async function maintainDatabase(client: SQL): Promise<void> {
  await client.begin(async (tx) => {
    await tx`SELECT set_config('statement_timeout', '5000', true), set_config('lock_timeout', '2000', true)`;
    await tx`DELETE FROM app.sessions WHERE id IN (SELECT id FROM app.sessions WHERE COALESCE(revoked_at, expires_at) < statement_timestamp() - interval '1 day' LIMIT 100 FOR UPDATE SKIP LOCKED)`;
    await tx`DELETE FROM app.auth_rate_limits WHERE key_hash IN (SELECT key_hash FROM app.auth_rate_limits WHERE expires_at < statement_timestamp() LIMIT 100 FOR UPDATE SKIP LOCKED)`;
    await tx`DELETE FROM app.auth_audit WHERE id IN (SELECT id FROM app.auth_audit WHERE occurred_at < statement_timestamp() - interval '7 days' LIMIT 100 FOR UPDATE SKIP LOCKED)`;
    await tx`DELETE FROM app.jobs WHERE id IN (SELECT id FROM app.jobs WHERE (status = 'completed' AND finished_at < statement_timestamp() - interval '7 days') OR (status = 'failed' AND finished_at < statement_timestamp() - interval '30 days') LIMIT 100 FOR UPDATE SKIP LOCKED)`;
    await tx`DELETE FROM app.match_results WHERE id IN (SELECT r.id FROM app.match_results r WHERE r.finished_at < statement_timestamp() - interval '90 days' AND NOT EXISTS (SELECT 1 FROM app.jobs j WHERE j.match_id = r.id AND j.status <> 'completed') LIMIT 100 FOR UPDATE OF r SKIP LOCKED)`;
  });
}

export function startDatabaseMaintenance(
  client: SQL,
  intervalMs: number,
  report: (healthy: boolean) => void,
  schedule: (delay: number, callback: () => void) => () => void = (delay, callback) => {
    const timer = setTimeout(callback, delay);
    timer.unref();

    return () => clearTimeout(timer);
  },
) {
  let active: Promise<void> | null = null;
  let stopped = false;
  let cancel: (() => void) | undefined;
  const arm = () => {
    if (stopped) return;

    cancel = schedule(intervalMs, () => {
      active = maintainDatabase(client)
        .then(
          () => report(true),
          () => report(false),
        )
        .finally(() => {
          active = null;
          arm();
        });
    });
  };
  arm();

  return async () => {
    stopped = true;
    cancel?.();
    await active;
  };
}
