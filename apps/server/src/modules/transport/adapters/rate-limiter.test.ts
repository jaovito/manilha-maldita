import { expect, test } from 'bun:test';
import { createLimiter } from './rate-limiter';

test('limits activity, memory and windows deterministically', () => {
  let now = 0;
  const limiter = createLimiter(() => now, 1);
  expect(limiter.allow('a', 2, 100)).toBe(true);
  expect(limiter.allow('a', 2, 100)).toBe(true);
  expect(limiter.allow('a', 2, 100)).toBe(false);
  expect(limiter.allow('b', 2, 100)).toBe(false);
  now = 100;
  expect(limiter.allow('b', 2, 100)).toBe(true);
  limiter.clear();
  expect(limiter.allow('c', 2, 100)).toBe(true);
});
