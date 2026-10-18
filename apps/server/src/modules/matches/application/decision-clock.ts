export type DecisionClock = Readonly<{
  decisionId: string;
  deadline: number | null;
  remainingMs: number | null;
  pausedAt: number | null;
  dependencies: readonly number[];
  budgets: readonly number[];
  connected: readonly boolean[];
  policy: 'all' | 'any';
  lastUpdatedAt: number;
  expired: boolean;
}>;

function assertTime(value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new Error('INVALID_CLOCK_TIME');
}

export function createClock(
  decisionId: string,
  now: number,
  durationMs: number | null,
  dependencies: readonly number[],
  protectionMs: number,
  budgets: readonly number[],
  policy: 'all' | 'any' = 'all',
): DecisionClock {
  assertTime(now);
  assertTime(protectionMs);
  if (durationMs !== null) assertTime(durationMs);
  if (
    decisionId.length === 0 ||
    (budgets.length !== 2 && budgets.length !== 4) ||
    budgets.some((budget) => !Number.isFinite(budget) || budget < 0 || budget > protectionMs) ||
    dependencies.length === 0 ||
    new Set(dependencies).size !== dependencies.length ||
    dependencies.some((seat) => !Number.isInteger(seat) || seat < 0 || seat >= budgets.length) ||
    (policy !== 'all' && policy !== 'any')
  ) {
    throw new Error('INVALID_CLOCK_CONFIGURATION');
  }
  const deadline = durationMs === null ? null : now + durationMs;
  if (deadline !== null) assertTime(deadline);
  return {
    decisionId,
    deadline,
    remainingMs: durationMs,
    pausedAt: null,
    dependencies: [...dependencies],
    budgets: [...budgets],
    connected: budgets.map(() => true),
    policy,
    lastUpdatedAt: now,
    expired: durationMs === 0,
  };
}

function missingSeats(clock: DecisionClock): number[] {
  if (clock.policy === 'any' && clock.dependencies.some((seat) => clock.connected[seat])) return [];
  return clock.dependencies.filter((seat) => !clock.connected[seat]);
}

function protectionRemaining(clock: DecisionClock): number {
  return Math.max(0, ...missingSeats(clock).map((seat) => clock.budgets[seat] ?? 0));
}

function advance(clock: DecisionClock, now: number): DecisionClock {
  assertTime(now);
  if (now < clock.lastUpdatedAt) throw new Error('CLOCK_MOVED_BACKWARDS');
  if (clock.expired) return { ...clock, lastUpdatedAt: now };
  if (clock.pausedAt === null) {
    const remainingMs = clock.deadline === null ? null : Math.max(0, clock.deadline - now);
    return { ...clock, lastUpdatedAt: now, remainingMs, expired: remainingMs === 0 };
  }
  const elapsed = now - clock.lastUpdatedAt;
  const protectedMs = protectionRemaining(clock);
  const chargedMs = Math.min(elapsed, protectedMs);
  const missing = new Set(missingSeats(clock));
  const budgets = clock.budgets.map((budget, seat) =>
    missing.has(seat) ? Math.max(0, budget - chargedMs) : budget,
  );
  if (elapsed < protectedMs) return { ...clock, budgets, lastUpdatedAt: now };
  const deadline =
    clock.remainingMs === null ? null : clock.lastUpdatedAt + protectedMs + clock.remainingMs;
  return {
    ...clock,
    budgets,
    pausedAt: null,
    deadline,
    remainingMs: deadline === null ? null : Math.max(0, deadline - now),
    lastUpdatedAt: now,
    // A disconnected player cannot retain an untimed turn after protection is spent.
    expired: deadline === null || now >= deadline,
  };
}

/** Connectivity changes take effect at now; earlier elapsed time uses the stored connectivity. */
export function updateConnectivity(
  clock: DecisionClock,
  now: number,
  connected: readonly boolean[],
): DecisionClock {
  if (
    connected.length !== clock.budgets.length ||
    connected.some((value) => typeof value !== 'boolean')
  ) {
    throw new Error('INVALID_CONNECTIVITY');
  }
  const advanced = advance(clock, now);
  const current = { ...advanced, connected: [...connected] };
  if (current.expired) return current;
  const missing = missingSeats(current);
  const protectedMs = protectionRemaining(current);
  if (protectedMs > 0) {
    return { ...current, pausedAt: current.pausedAt ?? now, deadline: null };
  }
  if (current.remainingMs === null && missing.length > 0)
    return { ...current, expired: true, pausedAt: null };
  return {
    ...current,
    pausedAt: null,
    deadline:
      current.pausedAt === null || current.remainingMs === null
        ? current.deadline
        : now + current.remainingMs,
  };
}

export function expirations(
  clock: DecisionClock,
  now: number,
  connected: readonly boolean[],
): Readonly<{ state: DecisionClock; expired: boolean }> {
  const state = updateConnectivity(clock, now, connected);
  return { state, expired: state.expired };
}

/** Schedule only the next boundary; stale callbacks must still check decisionId in the room queue. */
export function nextWakeAt(clock: DecisionClock): number | null {
  if (clock.expired) return null;
  if (clock.pausedAt === null) return clock.deadline;
  return clock.lastUpdatedAt + protectionRemaining(clock);
}
