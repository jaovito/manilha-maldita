import { type Card, cardKey, createDeck } from './cards';

export type PlayerCount = 2 | 4;

export function assertPlayerCount(count: number): asserts count is PlayerCount {
  if (count !== 2 && count !== 4) throw new Error('INVALID_PLAYER_COUNT');
}

export function assertSeat(seat: number, count: PlayerCount): void {
  assertPlayerCount(count);
  if (!Number.isInteger(seat) || seat < 0 || seat >= count) throw new Error('INVALID_SEAT');
}

/** Fisher–Yates choices from a trusted adapter: bounds 40, 39, …, 2.
 * Supplying data instead of a mutable RNG keeps rejection and replay pure.
 */
export function shuffleDeck(choices: readonly number[]): Card[] {
  if (choices.length !== 39) throw new Error('INVALID_SHUFFLE');
  for (const [offset, choice] of choices.entries()) {
    if (!Number.isInteger(choice) || choice < 0 || choice >= 40 - offset) {
      throw new Error('INVALID_SHUFFLE');
    }
  }
  const deck = createDeck();
  for (const [offset, choice] of choices.entries()) {
    const index = 39 - offset;
    const current = deck[index];
    const selected = deck[choice];
    if (current === undefined || selected === undefined) throw new Error('INVALID_SHUFFLE');
    deck[index] = selected;
    deck[choice] = current;
  }
  return deck;
}

export type Deal = Readonly<{
  hands: readonly (readonly Card[])[];
  vira: Card;
  stock: readonly Card[];
}>;

export function dealHand(deck: readonly Card[], count: PlayerCount, leader: number): Deal {
  assertSeat(leader, count);
  if (deck.length !== 40 || new Set(Array.from(deck, cardKey)).size !== 40) {
    throw new Error('INVALID_DECK');
  }
  // Deal one card per seat, clockwise from the leader, then reveal the vira.
  const hands = Array.from({ length: count }, (_, seat) => {
    const offset = (seat - leader + count) % count;
    return [0, 1, 2].map((round) => {
      const card = deck[round * count + offset];
      if (card === undefined) throw new Error('INVALID_DECK');
      return { ...card };
    });
  });
  const vira = deck[count * 3];
  if (vira === undefined) throw new Error('INVALID_DECK');
  return {
    hands,
    vira: { ...vira },
    stock: deck.slice(count * 3 + 1).map((card) => ({ ...card })),
  };
}
