// Keeps test configurations checkable before the first domain test is implemented.
import type { expect, test } from 'bun:test';

export type BunTestEnvironment = {
  expect: typeof expect;
  test: typeof test;
};
