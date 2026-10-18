import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { type Card, createDeck } from '../cards/cards';
import { type Play, resolveTrick } from './resolve-trick';

const vira: Card = { rank: '3', suit: 'diamonds' };
function play(
  seat: number,
  rank: Card['rank'],
  suit: Card['suit'] = 'clubs',
  covered = false,
): Play {
  return { seat, card: { rank, suit }, covered };
}

test('common ranks tie across suits; ties retain the leader', () => {
  expect(
    resolveTrick({
      playerCount: 2,
      leader: 1,
      trickNumber: 1,
      vira,
      plays: [play(1, 'A'), play(0, 'A', 'diamonds')],
    }),
  ).toEqual({ winner: 'tie', nextLeader: 1 });
});

test('winning player starts next trick, including clockwise wraparound', () => {
  expect(
    resolveTrick({
      playerCount: 4,
      leader: 3,
      trickNumber: 1,
      vira,
      plays: [play(3, '5'), play(0, '6'), play(1, '3'), play(2, '7')],
    }),
  ).toEqual({ winner: 'B', nextLeader: 1 });
});

test('equal partner maxima keep the first player, not the lowest seat', () => {
  expect(
    resolveTrick({
      playerCount: 4,
      leader: 2,
      trickNumber: 1,
      vira,
      plays: [play(2, '3'), play(3, '5'), play(0, '3', 'hearts'), play(1, '6')],
    }),
  ).toEqual({ winner: 'A', nextLeader: 2 });
});

test('partner strengths never add; opposing maxima tie', () => {
  expect(
    resolveTrick({
      playerCount: 4,
      leader: 0,
      trickNumber: 1,
      vira,
      plays: [play(0, '2'), play(1, '3'), play(2, '2', 'hearts'), play(3, '5')],
    }),
  ).toEqual({ winner: 'B', nextLeader: 1 });
  expect(
    resolveTrick({
      playerCount: 4,
      leader: 0,
      trickNumber: 1,
      vira,
      plays: [play(0, '3'), play(1, '3', 'hearts'), play(2, '3', 'spades'), play(3, '5')],
    }),
  ).toEqual({ winner: 'tie', nextLeader: 0 });
});

test('manilha beats common cards and uses suit order', () => {
  expect(
    resolveTrick({
      playerCount: 2,
      leader: 0,
      trickNumber: 1,
      vira,
      plays: [play(0, '4', 'diamonds'), play(1, '3')],
    }),
  ).toEqual({ winner: 'A', nextLeader: 0 });
  expect(
    resolveTrick({
      playerCount: 2,
      leader: 0,
      trickNumber: 1,
      vira,
      plays: [play(0, '4', 'hearts'), play(1, '4')],
    }),
  ).toEqual({ winner: 'B', nextLeader: 1 });
});

test('covered manilha loses to every open card; all covered tie', () => {
  expect(
    resolveTrick({
      playerCount: 2,
      leader: 0,
      trickNumber: 2,
      vira,
      plays: [play(0, '4', 'clubs', true), play(1, '5')],
    }),
  ).toEqual({ winner: 'B', nextLeader: 1 });
  expect(
    resolveTrick({
      playerCount: 2,
      leader: 1,
      trickNumber: 3,
      vira,
      plays: [play(1, '4', 'clubs', true), play(0, '5', 'clubs', true)],
    }),
  ).toEqual({ winner: 'tie', nextLeader: 1 });
});

test('invalid tricks reject duplicate cards, vira, illegal covers and out-of-turn plays', () => {
  const input = {
    playerCount: 2,
    leader: 0,
    trickNumber: 1,
    vira,
    plays: [play(0, '5'), play(1, '6')],
  } as const;
  const before = structuredClone(input);
  expect(() => resolveTrick({ ...input, plays: [] })).toThrow('INCOMPLETE_TRICK');
  expect(() => resolveTrick({ ...input, plays: [play(0, '5'), play(0, '6')] })).toThrow(
    'INVALID_PLAY_ORDER',
  );
  expect(() => resolveTrick({ ...input, plays: [play(0, '5'), play(1, '5')] })).toThrow(
    'DUPLICATE_CARD',
  );
  expect(() => resolveTrick({ ...input, plays: [play(0, '3', 'diamonds'), play(1, '5')] })).toThrow(
    'DUPLICATE_CARD',
  );
  expect(() =>
    resolveTrick({ ...input, plays: [play(0, '5', 'clubs', true), play(1, '6')] }),
  ).toThrow('INVALID_COVERED_PLAY');
  expect(() =>
    // @ts-expect-error malformed covered flag
    resolveTrick({ ...input, plays: [{ ...play(0, '5'), covered: 1 }, play(1, '6')] }),
  ).toThrow('INVALID_COVERED_PLAY');
  // @ts-expect-error invalid trick number
  expect(() => resolveTrick({ ...input, trickNumber: 4 })).toThrow('INVALID_TRICK_NUMBER');
  expect(input).toEqual(before);
});

test('generated valid tricks resolve deterministically without mutation', () => {
  fc.assert(
    fc.property(
      fc.shuffledSubarray(createDeck(), { minLength: 5, maxLength: 5 }),
      fc.integer({ min: 0, max: 3 }),
      (cards, leader) => {
        const [generatedVira, ...played] = cards;
        if (!generatedVira) throw new Error('Missing generated vira');
        const input = {
          playerCount: 4,
          leader,
          trickNumber: 1,
          vira: generatedVira,
          plays: played.map((card, offset) => ({
            seat: (leader + offset) % 4,
            card,
            covered: false,
          })),
        } as const;
        const before = structuredClone(input);
        const result = resolveTrick(input);
        expect(resolveTrick(input)).toEqual(result);
        expect(input).toEqual(before);
        expect(result.nextLeader).toBeGreaterThanOrEqual(0);
        expect(result.nextLeader).toBeLessThan(4);
      },
    ),
    { seed: 20261018, numRuns: 100 },
  );
});
