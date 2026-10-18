export type GuestSession = Readonly<{ id: string; nickname: string; expiresAt: number }>;

/** Cookies are bearer credentials; only the opaque session id crosses into rooms. */
export function createSessions(now: () => number, maximum = 10000, ttlMs = 86400000) {
  const sessions = new Map<string, GuestSession>();
  function prune() {
    for (const [token, session] of sessions) if (session.expiresAt <= now()) sessions.delete(token);
  }
  return {
    issue(nickname: string) {
      prune();
      if (sessions.size >= maximum) throw new Error('SESSION_CAPACITY');
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      const session = { id: crypto.randomUUID(), nickname, expiresAt: now() + ttlMs };
      sessions.set(token, session);
      return { token, session };
    },
    find(token: string | undefined) {
      if (!token) return undefined;
      const session = sessions.get(token);
      if (session && session.expiresAt > now()) return session;
      sessions.delete(token);
      return undefined;
    },
    clear() {
      sessions.clear();
    },
  };
}

/** Fixed windows bound both per-identity activity and the limiter's own memory. */
export function createLimiter(now: () => number, maximum = 10000) {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    allow(key: string, limit: number, windowMs = 60000) {
      const time = now();
      for (const [entry, value] of windows)
        if (time - value.start >= windowMs) windows.delete(entry);
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
