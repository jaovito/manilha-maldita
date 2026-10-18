import { type Card, cardKey, cardStrength, assertCard } from '../cards/cards';
import { type PlayerCount, assertSeat } from '../cards/deal';

export type Team = 'A' | 'B';
export type TrickWinner = Team | 'tie';
export type Play = Readonly<{ seat: number; card: Card; covered: boolean }>;
export type TrickResult = Readonly<{ winner: TrickWinner; nextLeader: number }>;

export function resolveTrick(
  input: Readonly<{
    playerCount: PlayerCount;
    leader: number;
    trickNumber: 1 | 2 | 3;
    vira: Card;
    plays: readonly Play[];
  }>,
): TrickResult {
  const { playerCount, leader, trickNumber, vira, plays } = input;
  assertSeat(leader, playerCount);
  assertCard(vira);
  if (![1, 2, 3].includes(trickNumber)) throw new Error('INVALID_TRICK_NUMBER');
  if (plays.length !== playerCount) throw new Error('INCOMPLETE_TRICK');
  const identities = new Set([cardKey(vira)]);
  let maximum = -2;
  let firstWinner = leader;
  let winningTeam: TrickWinner = 'tie';
  for (const [offset, play] of plays.entries()) {
    if (play.seat !== (leader + offset) % playerCount) throw new Error('INVALID_PLAY_ORDER');
    const identity = cardKey(play.card);
    if (identities.has(identity)) throw new Error('DUPLICATE_CARD');
    identities.add(identity);
    if (typeof play.covered !== 'boolean' || (play.covered && trickNumber === 1)) {
      throw new Error('INVALID_COVERED_PLAY');
    }
    const strength = play.covered ? -1 : cardStrength(play.card, vira);
    const team = play.seat % 2 === 0 ? 'A' : 'B';
    if (strength > maximum) {
      maximum = strength;
      firstWinner = play.seat;
      winningTeam = team;
    } else if (strength === maximum && team !== winningTeam) {
      winningTeam = 'tie';
    }
  }
  return { winner: winningTeam, nextLeader: winningTeam === 'tie' ? leader : firstWinner };
}
