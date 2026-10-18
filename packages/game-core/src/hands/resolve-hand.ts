import type { Team, TrickWinner } from '../tricks/resolve-trick';

export type HandResult =
  | Readonly<{ status: 'playing' }>
  | Readonly<{ status: 'won'; winner: Team }>
  | Readonly<{ status: 'void' }>;

export function resolveHand(results: readonly TrickWinner[]): HandResult {
  if (
    results.length > 3 ||
    Array.from(results).some((result) => !['A', 'B', 'tie'].includes(result))
  ) {
    throw new Error('INVALID_TRICK_HISTORY');
  }
  const [first, second, third] = results;
  if (first === undefined || second === undefined) return { status: 'playing' };
  const earlyWinner =
    first === 'tie' ? second : second === 'tie' || first === second ? first : 'tie';
  if (earlyWinner !== 'tie') {
    if (third !== undefined) throw new Error('HAND_ALREADY_FINISHED');
    return { status: 'won', winner: earlyWinner };
  }
  if (third === undefined) return { status: 'playing' };
  const winner = third === 'tie' ? first : third;
  return winner === 'tie' ? { status: 'void' } : { status: 'won', winner };
}
