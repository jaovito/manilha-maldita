import { expect, test } from 'bun:test';
import { DEFAULT_RETRY_POLICY, retryDelay, validateRetryPolicy } from './retry-policy';

test('retry delay increases exponentially and caps without overflow at the attempt limit', () => {
  validateRetryPolicy(DEFAULT_RETRY_POLICY);
  expect([1, 2, 3, 7, 100].map((attempt) => retryDelay(attempt, DEFAULT_RETRY_POLICY))).toEqual([
    1_000, 2_000, 4_000, 60_000, 60_000,
  ]);
});

test('invalid retry bounds and attempt counts are rejected', () => {
  for (const policy of [
    { baseDelayMs: 0, maxDelayMs: 100 },
    { baseDelayMs: 2, maxDelayMs: 1 },
    { baseDelayMs: 1.5, maxDelayMs: 100 },
    { baseDelayMs: 1, maxDelayMs: Number.POSITIVE_INFINITY },
    { baseDelayMs: 1, maxDelayMs: 86_400_001 },
  ])
    expect(() => validateRetryPolicy(policy)).toThrow('INVALID_RETRY_POLICY');
  for (const attempt of [0, -1, 1.5, 101, Number.NaN])
    expect(() => retryDelay(attempt, DEFAULT_RETRY_POLICY)).toThrow('INVALID_JOB_ATTEMPT');
});
