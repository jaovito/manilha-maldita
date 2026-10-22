import type { JobOutcome, JobQueue, WorkerEvent, WorkerRuntime } from '../ports/queue';

export function workerFixture() {
  let sequence = 0;
  let time = 0;
  let wake: () => void = () => {};

  const timers = new Map<number, { at: number; callback: () => void }>();
  const events: WorkerEvent[] = [];
  const state = { calls: 0, unsubscribed: 0, active: 0, maxActive: 0 };

  let operation: () => Promise<JobOutcome> = async () => 'idle';
  let unsubscribe = async () => {
    state.unsubscribed++;
  };

  const runtime: WorkerRuntime = {
    schedule(delay, callback) {
      const id = sequence++;
      timers.set(id, { at: time + delay, callback });

      return () => {
        timers.delete(id);
      };
    },

    report(event) {
      events.push(event);
    },
  };

  const queue: JobQueue = {
    async runNext() {
      state.calls++;
      state.active++;
      state.maxActive = Math.max(state.maxActive, state.active);

      try {
        return await operation();
      } finally {
        state.active--;
      }
    },

    async subscribe(callback) {
      wake = callback;
      return () => unsubscribe();
    },
  };

  return {
    queue,
    runtime,
    state,
    events,
    timers,

    setOperation(next: () => Promise<JobOutcome>) {
      operation = next;
    },

    setUnsubscribe(next: () => Promise<void>) {
      unsubscribe = next;
    },

    wake() {
      wake();
    },

    async flush(microtasks = 40) {
      for (let index = 0; index < microtasks; index++) await Promise.resolve();
    },

    advance(milliseconds: number) {
      time += milliseconds;

      const due = [...timers].filter(([, timer]) => timer.at <= time);

      for (const [id, timer] of due) {
        if (!timers.delete(id)) continue;

        timer.callback();
      }
    },
  };
}
