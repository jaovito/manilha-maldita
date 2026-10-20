/** Fixed windows bound both per-identity activity and the limiter's own memory. */
export function createLimiter(now: () => number, maximum = 10000) {
  const windows = new Map<string, { start: number; count: number }>();

  return {
    allow(key: string, limit: number, windowMs = 60000) {
      const time = now();

      for (const [entry, value] of windows) {
        if (time - value.start >= windowMs) windows.delete(entry);
      }

      const current = windows.get(key);
      if (!current) {
        if (windows.size >= maximum) return false;

        windows.set(key, { start: time, count: 1 });
        return true;
      }

      current.count++;
      return current.count <= limit;
    },

    clear() {
      windows.clear();
    },
  };
}
