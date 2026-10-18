import { expect, test } from 'bun:test';
import { resolveHand } from './resolve-hand';
import type { Team, TrickWinner } from '../tricks/resolve-trick';

test('all tie table rows and symmetric victories terminate at the right trick', () => {
  for (const winner of ['A', 'B'] as const) {
    const other: Team = winner === 'A' ? 'B' : 'A';
    const cases: TrickWinner[][] = [
      [winner, winner],
      [winner, 'tie'],
      ['tie', winner],
      [winner, other, winner],
      [other, winner, winner],
      [winner, other, 'tie'],
      ['tie', 'tie', winner],
    ];
    for (const results of cases) {
      expect(resolveHand(results)).toEqual({ status: 'won', winner });
      for (let length = 0; length < results.length; length++) {
        expect(resolveHand(results.slice(0, length))).toEqual({ status: 'playing' });
      }
    }
  }
  expect(resolveHand(['tie', 'tie', 'tie'])).toEqual({ status: 'void' });
});

test('reject histories after early termination and malformed results', () => {
  expect(() => resolveHand(Array(3))).toThrow('INVALID_TRICK_HISTORY');
  expect(() => resolveHand(['A', 'A', 'B'])).toThrow('HAND_ALREADY_FINISHED');
  expect(() => resolveHand(['A', 'tie', 'B'])).toThrow('HAND_ALREADY_FINISHED');
  expect(() => resolveHand(['tie', 'B', 'B'])).toThrow('HAND_ALREADY_FINISHED');
  expect(() => resolveHand(['tie', 'tie', 'tie', 'A'])).toThrow('INVALID_TRICK_HISTORY');
  // @ts-expect-error invalid team
  expect(() => resolveHand(['C'])).toThrow('INVALID_TRICK_HISTORY');
});
