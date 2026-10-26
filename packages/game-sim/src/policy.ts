import { cardKey, cardStrength } from '@truco/game-core/cards';
import type { PlayerCommand } from '@truco/game-core/match';
import type { PlayerView } from '@truco/game-core/projections';
import { trainingRaises } from './training-policy';

export type Policy = 'conservative' | 'aggressive' | 'probabilistic' | 'training';

/** The policy receives an authorized view, never a match state or an opponent hand. */
export function chooseAction(view: PlayerView, policy: Policy, sample: number): PlayerCommand {
  const own = view.hand.hands[view.seat];
  if (own?.visibility !== 'visible' || !Number.isFinite(sample) || sample < 0 || sample >= 1)
    throw new Error('INVALID_POLICY_INPUT');
  const cards = [...own.cards].sort(
    (a, b) => cardStrength(a, view.hand.vira) - cardStrength(b, view.hand.vira),
  );
  const weakest = cards[0];
  const strongest = cards.at(-1);
  if ((!weakest || !strongest) && view.phase.type === 'RAISE_RESPONSE')
    return { type: 'RESPOND_RAISE', response: 'fold' };
  if (!weakest || !strongest) throw new Error('INVALID_POLICY_INPUT');
  const known = view.powers?.intel;
  const seen = [...view.hand.plays, ...view.hand.completedTricks.flatMap((trick) => trick.plays)];
  const intelStillRelevant =
    known &&
    !view.hand.plays.some((play) => play.seat === known.target) &&
    !seen.some((play) => 'card' in play && cardKey(play.card) === cardKey(known.card));
  const threats = view.hand.plays.flatMap((play) =>
    play.seat % 2 !== view.seat % 2 && !play.covered && 'card' in play
      ? [cardStrength(play.card, view.hand.vira) + (play.power === 'boost' ? 1 : 0)]
      : [],
  );
  if (intelStillRelevant) threats.push(cardStrength(known.card, view.hand.vira));
  const observedMaximum = Math.max(-1, ...threats);
  const conservativeCard =
    cards.find((card) => cardStrength(card, view.hand.vira) > observedMaximum) ?? weakest;

  const aggressive =
    policy === 'training'
      ? trainingRaises(view, sample)
      : policy === 'aggressive' || (policy === 'probabilistic' && sample >= 0.5);
  const power = view.powers?.players[view.seat];
  const affordable =
    power?.power &&
    power.energy >= (power.power === 'spy' || power.power === 'mask' ? 1 : 2) &&
    !power.used;
  switch (view.phase.type) {
    case 'PREPARATION':
      if (affordable && power.power === 'spy')
        return {
          type: 'PREPARE',
          intent: { type: 'spy', target: (view.seat + 1) % view.playerCount },
        };
      if (affordable && power.power === 'exchange')
        return { type: 'PREPARE', intent: { type: 'exchange', card: weakest } };
      return { type: 'PREPARE', intent: { type: 'pass' } };
    case 'ELEVEN_DECISION':
      return {
        type: 'DECIDE_ELEVEN',
        response: aggressive || cardStrength(strongest, view.hand.vira) >= 8 ? 'play' : 'fold',
      };
    case 'RAISE_RESPONSE':
      return {
        type: 'RESPOND_RAISE',
        response:
          aggressive && view.hand.betting.pendingStake !== 12
            ? 'raise'
            : cardStrength(strongest, view.hand.vira) >= 7
              ? 'accept'
              : 'fold',
      };
    case 'TURN': {
      const team = view.seat % 2 === 0 ? 'A' : 'B';
      if (
        aggressive &&
        view.hand.kind === 'normal' &&
        view.hand.betting.lastRaisingTeam !== team &&
        view.hand.betting.acceptedStake < 12
      )
        return { type: 'REQUEST_RAISE' };
      const card =
        policy === 'probabilistic'
          ? (cards[Math.floor(sample * cards.length)] ?? weakest)
          : aggressive
            ? strongest
            : conservativeCard;
      const activation =
        affordable && power.power === 'mask'
          ? 'mask'
          : affordable && power.power === 'boost' && cardStrength(card, view.hand.vira) < 9
            ? 'boost'
            : undefined;
      return {
        type: 'PLAY_CARD',
        card,
        covered: false,
        ...(activation ? { power: activation } : {}),
      };
    }
    default:
      throw new Error('INVALID_POLICY_INPUT');
  }
}
