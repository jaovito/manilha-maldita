export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
export const SUITS = ['diamonds', 'spades', 'hearts', 'clubs'] as const;
export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
export type Card = Readonly<{ rank: Rank; suit: Suit }>;

export function isCard(value: unknown): value is Card {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'rank' in value &&
    RANKS.some((rank) => rank === value.rank) &&
    'suit' in value &&
    SUITS.some((suit) => suit === value.suit)
  );
}

export function assertCard(value: unknown): asserts value is Card {
  if (!isCard(value)) throw new Error('INVALID_CARD');
}

// Physical identity is internal; it must never identify hidden cards in transport DTOs.
export function cardKey(card: Card): string {
  assertCard(card);
  return `${card.rank}:${card.suit}`;
}

export function createDeck(): Card[] {
  return RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })));
}

export function manilhaRank(vira: Card): Rank {
  assertCard(vira);
  const rank = RANKS[(RANKS.indexOf(vira.rank) + 1) % RANKS.length];
  if (rank === undefined) throw new Error('INVALID_CARD');
  return rank;
}

export function cardStrength(card: Card, vira: Card): number {
  assertCard(card);
  return card.rank === manilhaRank(vira)
    ? RANKS.length + SUITS.indexOf(card.suit)
    : RANKS.indexOf(card.rank);
}
