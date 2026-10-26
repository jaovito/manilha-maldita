import { cardStrength } from '@truco/game-core/cards';
import type { PlayerView } from '@truco/game-core/projections';

/** Confidence uses only the bot's cards and public tricks; occasional bluffs remain fallible. */
export function trainingRaises(view: PlayerView, sample: number): boolean {
  const own = view.hand.hands[view.seat];
  if (own?.visibility !== 'visible' || !own.cards.length) return false;

  const strengths = own.cards
    .map((card) => cardStrength(card, view.hand.vira))
    .sort((a, b) => b - a);
  const strongest = strengths[0] ?? 0;
  const team = view.seat % 2 === 0 ? 'A' : 'B';
  const wonTrick = view.hand.completedTricks.some((trick) => trick.result.winner === team);
  const backup = strengths[1] ?? (wonTrick ? strongest : 0);
  const value = view.hand.betting.pendingStake ?? view.hand.betting.acceptedStake;
  const threshold = value < 3 ? 15 : value < 6 ? 18 : value < 9 ? 21 : 23;
  const beaten = view.hand.plays.some(
    (play) =>
      play.seat % 2 !== view.seat % 2 &&
      !play.covered &&
      'card' in play &&
      cardStrength(play.card, view.hand.vira) + (play.power === 'boost' ? 1 : 0) > strongest,
  );

  return !beaten && strongest + backup >= threshold
    ? sample < 0.8
    : sample < (value < 6 ? 0.04 : 0.01);
}
