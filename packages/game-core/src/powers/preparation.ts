import { assertCard, cardKey } from '../cards/cards';
import { assertSeat } from '../cards/deal';
import type { MatchState, Transition } from '../match/types';
import { assertAvailable, POWER_COST, type PreparationIntent } from './powers';

export function prepare(state: MatchState, seat: number, intent: PreparationIntent): Transition {
  if (state.phase.type !== 'PREPARATION' || !state.powers) throw new Error('INVALID_PHASE');

  const powers = state.powers;
  if (powers.commitments[seat] !== null) throw new Error('ALREADY_PREPARED');

  switch (intent.type) {
    case 'pass':
      break;
    case 'spy':
      assertAvailable(state, seat, 'spy');
      assertSeat(intent.target, state.playerCount);
      if (intent.target % 2 === seat % 2) throw new Error('INVALID_POWER_TARGET');
      break;
    case 'exchange':
      assertAvailable(state, seat, 'exchange');
      assertCard(intent.card);
      if (!state.hand.hands[seat]?.some((card) => cardKey(card) === cardKey(intent.card)))
        throw new Error('CARD_NOT_OWNED');
      break;
    default:
      throw new Error('INVALID_COMMAND');
  }

  const commitments = powers.commitments.map((value, owner) => (owner === seat ? intent : value));
  const committed = { ...state, revision: state.revision + 1, powers: { ...powers, commitments } };
  if (commitments.some((value) => value === null)) return { state: committed, events: [] };

  let hands = state.hand.hands.map((cards) => [...cards]);
  const stock = [...state.hand.stock];
  const discards = [...(state.hand.discards ?? [])];

  // Remove every selected card before canonical clockwise replacement.
  hands = hands.map((cards, owner) => {
    const choice = commitments[owner];
    return cards.filter((card) => {
      if (choice?.type !== 'exchange' || cardKey(card) !== cardKey(choice.card)) return true;
      discards.push(card);
      return false;
    });
  });

  for (let offset = 0; offset < state.playerCount; offset++) {
    const owner = (state.hand.leader + offset) % state.playerCount;
    if (commitments[owner]?.type !== 'exchange') continue;
    const replacement = stock.shift();
    if (!replacement) throw new Error('INVALID_POWER_SETUP');
    hands[owner]?.push(replacement);
  }

  const intel = commitments.map((choice, owner) => {
    if (choice?.type !== 'spy') return null;
    const card = hands[choice.target]?.[powers.spies[owner] ?? -1];
    if (!card) throw new Error('INVALID_POWER_SETUP');
    return { target: choice.target, card };
  });
  const activations = commitments.flatMap((choice, owner) =>
    choice && choice.type !== 'pass'
      ? [{ seat: owner, power: choice.type, target: choice.type === 'spy' ? choice.target : owner }]
      : [],
  );

  return {
    state: {
      ...committed,
      phase: { type: 'TURN', seat: state.hand.leader },
      hand: { ...state.hand, hands, stock, discards },
      powers: {
        ...committed.powers,
        intel,
        activations,
        energy: powers.energy.map((value, owner) => {
          const choice = commitments[owner];
          return choice && choice.type !== 'pass' ? value - POWER_COST[choice.type] : value;
        }),
        used: commitments.map((choice) => choice !== null && choice.type !== 'pass'),
      },
    },
    events: [],
  };
}
