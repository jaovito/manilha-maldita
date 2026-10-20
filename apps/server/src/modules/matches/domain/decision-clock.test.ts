import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { createClock, expirations, nextWakeAt, updateConnectivity } from './decision-clock';

test('deadline is exclusive for commands and expiration stays closed', () => {
  const clock = Object.freeze(createClock('d1', 100, 30, [0], 60, [60, 60]));
  expect(nextWakeAt(clock)).toBe(130);
  expect(expirations(clock, 129, [true, true]).expired).toBe(false);
  const expired = expirations(clock, 130, [false, true]);
  expect(expired.expired).toBe(true);
  expect(nextWakeAt(expired.state)).toBe(null);
  expect(expirations(expired.state, 140, [true, true]).expired).toBe(true);
  expect(clock.remainingMs).toBe(30);
  expect(createClock('zero', 0, 0, [0], 0, [0, 0]).expired).toBe(true);
});

test('reconnection resumes the remaining decision time and charges only needed absence', () => {
  const initial = createClock('d1', 0, 30, [0], 60, [60, 60]);
  const irrelevant = updateConnectivity(initial, 5, [true, false]);
  expect(irrelevant.pausedAt).toBe(null);
  expect(irrelevant.budgets).toEqual([60, 60]);
  const paused = Object.freeze(updateConnectivity(irrelevant, 10, [false, false]));
  expect(paused.remainingMs).toBe(20);
  expect(paused.deadline).toBe(null);
  expect(paused.pausedAt).toBe(10);
  expect(nextWakeAt(paused)).toBe(70);
  const reconnected = updateConnectivity(paused, 25, [true, false]);
  expect(reconnected.pausedAt).toBe(null);
  expect(reconnected.deadline).toBe(45);
  expect(reconnected.budgets).toEqual([45, 60]);
  expect(paused.budgets).toEqual([60, 60]);
  const pausedAgain = updateConnectivity(reconnected, 30, [false, false]);
  expect(pausedAgain.remainingMs).toBe(15);
  expect(nextWakeAt(pausedAgain)).toBe(75);
  const exhausted = expirations(pausedAgain, 80, [false, false]);
  expect(exhausted.expired).toBe(false);
  expect(exhausted.state.deadline).toBe(90);
  expect(exhausted.state.budgets).toEqual([0, 60]);
  expect(expirations(exhausted.state, 90, [false, false]).expired).toBe(true);
  const next = createClock('d2', 90, 20, [0], 60, exhausted.state.budgets);
  expect(updateConnectivity(next, 90, [false, false]).pausedAt).toBe(null);
});

test('simultaneous protected absences consume budgets in parallel rather than adding pauses', () => {
  const initial = createClock('all', 0, 30, [0, 1], 60, [20, 60]);
  const paused = updateConnectivity(initial, 0, [false, false]);
  expect(nextWakeAt(paused)).toBe(60);
  const tick = expirations(paused, 25, [false, false]);
  expect(tick.state.budgets).toEqual([0, 35]);
  expect(tick.state.remainingMs).toBe(30);
  expect(tick.state.pausedAt).toBe(0);
  const after = expirations(tick.state, 65, [false, false]);
  expect(after.state.deadline).toBe(90);
  expect(after.state.remainingMs).toBe(25);
  expect(after.state.budgets).toEqual([0, 0]);
  expect(nextWakeAt(after.state)).toBe(90);
  expect(expirations(after.state, 90, [false, false]).expired).toBe(true);
});

test('team decisions continue while either partner is connected', () => {
  const clock = createClock('team', 0, 30, [0, 2], 60, [60, 60, 60, 60], 'any');
  const oneAbsent = updateConnectivity(clock, 10, [false, true, true, true]);
  expect(oneAbsent.deadline).toBe(30);
  expect(oneAbsent.pausedAt).toBe(null);
  expect(oneAbsent.budgets).toEqual([60, 60, 60, 60]);
  const bothAbsent = updateConnectivity(oneAbsent, 15, [false, true, false, true]);
  expect(bothAbsent.remainingMs).toBe(15);
  expect(bothAbsent.pausedAt).toBe(15);
  const partnerReturns = updateConnectivity(bothAbsent, 25, [false, true, true, true]);
  expect(partnerReturns.budgets).toEqual([50, 60, 50, 60]);
  expect(partnerReturns.deadline).toBe(40);
  expect(expirations(partnerReturns, 40, [false, true, true, true]).expired).toBe(true);
});

test('untimed turns remain indefinite while connected but expire after absent protection is consumed', () => {
  const clock = createClock('untimed', 0, null, [0], 60, [60, 60]);
  expect(nextWakeAt(clock)).toBe(null);
  expect(expirations(clock, 100, [true, true]).expired).toBe(false);
  const paused = updateConnectivity(clock, 100, [false, true]);
  expect(nextWakeAt(paused)).toBe(160);
  const returned = updateConnectivity(paused, 120, [true, true]);
  expect(returned.remainingMs).toBe(null);
  expect(returned.deadline).toBe(null);
  expect(returned.budgets).toEqual([40, 60]);
  const again = updateConnectivity(returned, 150, [false, true]);
  expect(expirations(again, 189, [false, true]).expired).toBe(false);
  expect(expirations(again, 190, [true, true]).expired).toBe(true);
  const exhausted = createClock('none', 0, null, [0], 60, [0, 60]);
  expect(updateConnectivity(exhausted, 0, [false, true]).expired).toBe(true);
});

test('newly absent seats do not retroactively consume protection', () => {
  let clock = createClock('all', 0, 30, [0, 1], 60, [60, 60]);
  clock = updateConnectivity(clock, 0, [false, true]);
  clock = updateConnectivity(clock, 20, [false, false]);
  expect(clock.budgets).toEqual([40, 60]);
  expect(nextWakeAt(clock)).toBe(80);
  clock = updateConnectivity(clock, 40, [true, false]);
  expect(clock.budgets).toEqual([20, 40]);
  expect(clock.pausedAt).toBe(0);
  clock = updateConnectivity(clock, 50, [true, true]);
  expect(clock.budgets).toEqual([20, 30]);
  expect(clock.deadline).toBe(80);
});

test('rejects invalid settings, connectivity and time without modifying input', () => {
  for (const time of [-1, NaN, Infinity]) {
    expect(() => createClock('bad', time, 20, [0], 60, [60, 60])).toThrow('INVALID_CLOCK_TIME');
    expect(() => createClock('bad', 0, time, [0], 60, [60, 60])).toThrow('INVALID_CLOCK_TIME');
    expect(() => createClock('bad', 0, 20, [0], time, [0, 0])).toThrow('INVALID_CLOCK_TIME');
  }
  expect(() => createClock('bad', Number.MAX_VALUE, Number.MAX_VALUE, [0], 0, [0, 0])).toThrow(
    'INVALID_CLOCK_TIME',
  );
  for (const budgets of [[], [60], [60, 60, 60], [61, 60], [-1, 60], [NaN, 60]]) {
    expect(() => createClock('bad', 0, 20, [0], 60, budgets)).toThrow(
      'INVALID_CLOCK_CONFIGURATION',
    );
  }
  for (const dependencies of [[], [0, 0], [-1], [2], [0.5], [NaN]]) {
    expect(() => createClock('bad', 0, 20, dependencies, 60, [60, 60])).toThrow(
      'INVALID_CLOCK_CONFIGURATION',
    );
  }
  expect(() => createClock('', 0, 20, [0], 60, [60, 60])).toThrow('INVALID_CLOCK_CONFIGURATION');
  // @ts-expect-error unknown policy is rejected at the boundary
  expect(() => createClock('bad', 0, 20, [0], 60, [60, 60], 'none')).toThrow(
    'INVALID_CLOCK_CONFIGURATION',
  );
  const clock = Object.freeze(createClock('valid', 100, 20, [0], 60, [60, 60]));
  expect(() => updateConnectivity(clock, 99, [true, true])).toThrow('CLOCK_MOVED_BACKWARDS');
  expect(() => updateConnectivity(clock, NaN, [true, true])).toThrow('INVALID_CLOCK_TIME');
  expect(() => updateConnectivity(clock, 110, [true])).toThrow('INVALID_CONNECTIVITY');
  // @ts-expect-error runtime connectivity parsing
  expect(() => updateConnectivity(clock, 110, [true, 1])).toThrow('INVALID_CONNECTIVITY');
  expect(clock.lastUpdatedAt).toBe(100);
  expect(clock.budgets).toEqual([60, 60]);
});

test('splitting a protected interval preserves cumulative budget and deadline', () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), (a, b) => {
      const paused = updateConnectivity(createClock('p', 0, 100, [0, 1], 60, [20, 60]), 0, [
        false,
        false,
      ]);
      const split = updateConnectivity(updateConnectivity(paused, a, [false, false]), a + b, [
        false,
        false,
      ]);
      const single = updateConnectivity(paused, a + b, [false, false]);
      expect(split).toEqual(single);
      expect(split.budgets.every((budget) => budget >= 0 && budget <= 60)).toBe(true);
    }),
  );
});
