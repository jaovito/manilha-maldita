import type { Ports } from '../../application/ports/runtime';

type RuntimeSources = Readonly<{
  wallTime?: () => number;
  randomValues?: (values: Uint32Array) => void;
  timer?: (delay: number, callback: () => void) => () => void;
}>;

/** Epoch milliseconds remain suitable for UI deadlines; backward wall-clock jumps cannot extend time. */
export function createRuntimePorts(sources: RuntimeSources = {}): Ports {
  const wallTime = sources.wallTime ?? Date.now;
  const randomValues =
    sources.randomValues ??
    ((values) => {
      crypto.getRandomValues(values);
    });
  const timer =
    sources.timer ??
    ((delay, callback) => {
      const handle = setTimeout(callback, delay);

      return () => clearTimeout(handle);
    });

  let lastTime = wallTime();
  const now = () => {
    lastTime = Math.max(lastTime, wallTime());

    return lastTime;
  };

  return {
    now,
    id: () => crypto.randomUUID(),
    randomInt(exclusiveMax) {
      if (!Number.isSafeInteger(exclusiveMax) || exclusiveMax < 1 || exclusiveMax > 2 ** 32) {
        throw new Error('INVALID_RANDOM_BOUND');
      }

      const range = 2 ** 32;
      const limit = Math.floor(range / exclusiveMax) * exclusiveMax;
      const values = new Uint32Array(1);

      do {
        randomValues(values);
      } while ((values[0] ?? range) >= limit);

      return (values[0] ?? 0) % exclusiveMax;
    },
    schedule(at, callback) {
      if (!Number.isFinite(at) || at < 0) throw new Error('INVALID_SCHEDULE_TIME');

      let cancelled = false;
      let cancelTimer: () => void = () => {};
      const arm = () => {
        cancelTimer = timer(Math.max(1, Math.min(2147483647, at - now())), () => {
          if (cancelled) return;
          if (now() < at) arm();
          else callback();
        });
      };
      arm();

      return () => {
        cancelled = true;
        cancelTimer();
      };
    },
  };
}
