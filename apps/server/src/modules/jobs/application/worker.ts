import type { JobQueue, WorkerEvent, WorkerOptions, WorkerRuntime } from './ports/queue';

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const MIN_POLL_INTERVAL_MS = 10;
const MAX_POLL_INTERVAL_MS = 60_000;

const DEFAULT_MAX_JOBS_PER_WAKE = 25;
const MIN_JOBS_PER_WAKE = 1;
const MAX_JOBS_PER_WAKE = 100;

/** One operation at a time per worker. Extra workers coordinate through PostgreSQL row locks. */
export async function startJobWorker(
  queue: JobQueue,
  runtime: WorkerRuntime,
  options: WorkerOptions = {},
): Promise<{ stop(): Promise<void> }> {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxJobsPerWake = options.maxJobsPerWake ?? DEFAULT_MAX_JOBS_PER_WAKE;

  if (
    !Number.isInteger(pollIntervalMs) ||
    pollIntervalMs < MIN_POLL_INTERVAL_MS ||
    pollIntervalMs > MAX_POLL_INTERVAL_MS ||
    !Number.isInteger(maxJobsPerWake) ||
    maxJobsPerWake < MIN_JOBS_PER_WAKE ||
    maxJobsPerWake > MAX_JOBS_PER_WAKE
  )
    throw new Error('INVALID_WORKER_OPTIONS');

  let stopped = false;
  let scheduled: (() => void) | null = null;
  let poll: (() => void) | null = null;
  let active: Promise<void> | null = null;
  let wakeAgain = false;
  let stopping: Promise<void> | undefined;

  const cancelScheduled = () => {
    scheduled?.();
    scheduled = null;
  };

  const report = (event: WorkerEvent) => {
    try {
      runtime.report(event);
    } catch {
      /* Telemetry cannot change job processing. */
    }
  };

  const drain = async () => {
    try {
      for (let count = 0; count < maxJobsPerWake && !stopped; count++) {
        const outcome = await queue.runNext();
        if (outcome === 'idle') return;

        report(outcome);
      }

      wakeAgain = !stopped;
    } catch {
      // No raw database/handler errors, job IDs or payloads cross the operational boundary.
      report('queue_unavailable');
      wakeAgain = false;
    }
  };

  const wake = () => {
    if (stopped || scheduled) return;

    if (active) {
      wakeAgain = true;
      return;
    }

    scheduled = runtime.schedule(0, () => {
      scheduled = null;
      if (stopped) return;

      wakeAgain = false;
      active = drain().finally(() => {
        active = null;
        if (wakeAgain) wake();
      });
    });
  };

  const armPoll = () => {
    poll = runtime.schedule(pollIntervalMs, () => {
      poll = null;
      if (stopped) return;

      wake();
      armPoll();
    });
  };

  let unsubscribe: () => Promise<void>;

  try {
    // The adapter also invokes wake on reconnect; query only after LISTEN is established.
    unsubscribe = await queue.subscribe(wake);
  } catch (error) {
    stopped = true;
    cancelScheduled();
    await active;
    throw error;
  }

  armPoll();
  wake();

  return {
    stop() {
      stopping ??= (async () => {
        stopped = true;
        cancelScheduled();
        poll?.();

        try {
          await unsubscribe();
        } finally {
          await active;
        }
      })();

      return stopping;
    },
  };
}
