import { expect, test } from 'bun:test';
import fc from 'fast-check';
import {
  RANKS,
  SUITS,
  type Card,
  cardKey,
  cardStrength,
  createDeck,
  isCard,
  manilhaRank,
} from './cards';
import { assertSeat, dealHand, shuffleDeck } from './deal';

test('deck contains the 40 unique physical cards and independent objects', () => {
  const deck = createDeck();
  expect(deck).toHaveLength(40);
  expect(new Set(deck.map(cardKey)).size).toBe(40);
  expect(deck).toEqual(createDeck());
  expect(deck[0]).not.toBe(createDeck()[0]);
});

test('all viras, common ties and manilha suit order follow the contract', () => {
  for (const [index, rank] of RANKS.entries()) {
    const vira: Card = { rank, suit: 'diamonds' };
    expect<string | undefined>(manilhaRank(vira)).toBe(RANKS[(index + 1) % 10]);
    const manilhas = SUITS.map((suit) => cardStrength({ rank: manilhaRank(vira), suit }, vira));
    expect(manilhas).toEqual([10, 11, 12, 13]);
    for (const common of RANKS.filter((candidate) => candidate !== manilhaRank(vira))) {
      for (const suit of SUITS) {
        expect(cardStrength({ rank: common, suit }, vira)).toBe(RANKS.indexOf(common));
        expect(cardStrength({ rank: common, suit }, vira)).toBeLessThan(10);
      }
    }
  }
});

test('invalid card values are rejected without including their contents in errors', () => {
  for (const value of [
    null,
    undefined,
    3,
    '3:clubs',
    {},
    { rank: '8', suit: 'clubs' },
    { rank: '3', suit: 'secret' },
  ]) {
    expect(isCard(value)).toBe(false);
  }
  // Deliberately cross the TypeScript boundary to exercise runtime validation.
  // @ts-expect-error invalid rank
  expect(() => cardKey({ rank: '8', suit: 'clubs' })).toThrow('INVALID_CARD');
  // @ts-expect-error invalid vira
  expect(() => manilhaRank(null)).toThrow('INVALID_CARD');
  // @ts-expect-error invalid compared card
  expect(() => cardStrength({}, { rank: '3', suit: 'clubs' })).toThrow('INVALID_CARD');
});

test('Fisher–Yates accepts inclusive lower and exclusive upper bounds deterministically', () => {
  const identity = Array.from({ length: 39 }, (_, index) => 39 - index);
  expect(shuffleDeck(identity)).toEqual(createDeck());
  expect(shuffleDeck(Array(39).fill(0))).not.toEqual(createDeck());
  expect(identity).toEqual(Array.from({ length: 39 }, (_, index) => 39 - index));
  for (const choices of [
    [],
    Array(40).fill(0),
    [40, ...identity.slice(1)],
    [-1, ...identity.slice(1)],
    [0.5, ...identity.slice(1)],
    [NaN, ...identity.slice(1)],
    [...identity.slice(0, 38), 2],
  ]) {
    expect(() => shuffleDeck(choices)).toThrow('INVALID_SHUFFLE');
  }
});

test('deal conserves all cards for both formats and every leader', () => {
  const choiceArbitrary = fc.tuple(
    ...Array.from({ length: 39 }, (_, index) => fc.integer({ min: 0, max: 39 - index })),
  );
  fc.assert(
    fc.property(choiceArbitrary, (choices) => {
      const deck = shuffleDeck(choices);
      const before = structuredClone(deck);
      for (const count of [2, 4] as const) {
        for (let leader = 0; leader < count; leader++) {
          const deal = dealHand(deck, count, leader);
          expect(deal.hands).toHaveLength(count);
          for (const hand of deal.hands) expect(hand).toHaveLength(3);
          expect(deal.hands[leader]?.[0]).toEqual(deck[0]);
          expect(deal.hands[(leader + 1) % count]?.[0]).toEqual(deck[1]);
          expect(deal.hands[leader]?.[2]).toEqual(deck[count * 2]);
          expect<Card | undefined>(deal.vira).toEqual(deck[count * 3]);
          expect(deal.stock).toHaveLength(39 - count * 3);
          expect(new Set([...deal.hands.flat(), deal.vira, ...deal.stock].map(cardKey)).size).toBe(
            40,
          );
          expect(deal.hands[leader]?.[0]).not.toBe(deck[0]);
        }
      }
      expect(deck).toEqual(before);
      expect(shuffleDeck(choices)).toEqual(deck);
    }),
    { seed: 20261018, numRuns: 100 },
  );
});

test('invalid deals and seats are rejected without mutating the deck', () => {
  const deck = createDeck();
  const before = structuredClone(deck);
  const sparseDeck = createDeck();
  delete sparseDeck[39];
  expect(() => dealHand(sparseDeck, 2, 0)).toThrow('INVALID_CARD');
  expect(() => dealHand(deck.slice(1), 2, 0)).toThrow('INVALID_DECK');
  expect(() => dealHand([...deck.slice(0, 39), { rank: '4', suit: 'diamonds' }], 2, 0)).toThrow(
    'INVALID_DECK',
  );
  // @ts-expect-error unsupported format
  expect(() => dealHand(deck, 3, 0)).toThrow('INVALID_PLAYER_COUNT');
  for (const seat of [-1, 2, 0.5, NaN, Infinity]) {
    expect(() => assertSeat(seat, 2)).toThrow('INVALID_SEAT');
  }
  expect(deck).toEqual(before);
});
