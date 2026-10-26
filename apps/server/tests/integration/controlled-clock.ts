import { createRuntimePorts } from '../../src/modules/rooms';

export function controlledClock() {
  let now = Date.now();
  const timers = new Map<number, { at: number; callback: () => void }>();
  let sequence = 0;
  const ports = createRuntimePorts({
    wallTime: () => now,
    timer(delay, callback) {
      const id = sequence++;
      timers.set(id, { at: now + delay, callback });

      return () => {
        timers.delete(id);
      };
    },
  });

  return {
    ports,
    async advance(until: number) {
      now = Math.max(now, until);

      for (let iteration = 0; iteration < 100; iteration++) {
        const due = [...timers].find(([, timer]) => timer.at <= now);

        if (!due) return;

        timers.delete(due[0]);
        due[1].callback();
        for (let step = 0; step < 20; step++) await Promise.resolve();
      }

      throw new Error('Fixture timer loop');
    },
  };
}
