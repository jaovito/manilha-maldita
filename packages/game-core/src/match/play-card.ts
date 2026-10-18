import { assertCard, cardKey } from '../cards/cards';
import { resolveHand } from '../hands/resolve-hand';
import { resolveTrick } from '../tricks/resolve-trick';
import { finishHand } from './lifecycle';
import type { MatchState, PlayerCommand, Transition } from './types';

export function playCard(
  state: MatchState,
  seat: number,
  command: Extract<PlayerCommand, { type: 'PLAY_CARD' }>,
): Transition {
  if (state.phase.type !== 'TURN') throw new Error('INVALID_PHASE');
  if (seat !== state.phase.seat) throw new Error('NOT_YOUR_TURN');
  assertCard(command.card);
  const { hand } = state;
  if (
    typeof command.covered !== 'boolean' ||
    (command.covered && (hand.completedTricks.length === 0 || hand.kind === 'decisive'))
  ) {
    throw new Error('INVALID_COVERED_PLAY');
  }
  const ownCards = hand.hands[seat];
  const card = ownCards?.find((candidate) => cardKey(candidate) === cardKey(command.card));
  if (card === undefined) throw new Error('CARD_NOT_OWNED');
  const hands = hand.hands.map((cards, owner) =>
    owner === seat ? cards.filter((candidate) => cardKey(candidate) !== cardKey(card)) : cards,
  );
  const plays = [...hand.plays, { seat, card, covered: command.covered }];
  const playedState = { ...state, hand: { ...hand, hands, plays } };
  if (plays.length < state.playerCount) {
    return {
      state: {
        ...playedState,
        revision: state.revision + 1,
        phase: { type: 'TURN', seat: (seat + 1) % state.playerCount },
      },
      events: [],
    };
  }
  const trickNumber = hand.completedTricks.length + 1;
  if (trickNumber !== 1 && trickNumber !== 2 && trickNumber !== 3)
    throw new Error('INVALID_TRICK_NUMBER');
  const result = resolveTrick({
    playerCount: state.playerCount,
    leader: hand.trickLeader,
    trickNumber,
    vira: hand.vira,
    plays,
  });
  const completedTricks = [...hand.completedTricks, { leader: hand.trickLeader, plays, result }];
  const nextState = {
    ...playedState,
    hand: { ...playedState.hand, plays: [], completedTricks, trickLeader: result.nextLeader },
  };
  const handResult = resolveHand(completedTricks.map((trick) => trick.result.winner));
  if (handResult.status !== 'playing') {
    const ended = finishHand(
      nextState,
      handResult.status === 'void' ? 'tie' : handResult.winner,
      handResult.status === 'void' ? 0 : hand.betting.acceptedStake,
    );
    return { state: ended.state, events: [{ type: 'TRICK_ENDED', result }, ...ended.events] };
  }
  return {
    state: {
      ...nextState,
      revision: state.revision + 1,
      phase: { type: 'TURN', seat: result.nextLeader },
    },
    events: [{ type: 'TRICK_ENDED', result }],
  };
}
