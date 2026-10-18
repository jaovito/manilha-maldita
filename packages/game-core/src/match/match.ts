import { requestRaise, respondRaise } from '../betting/betting';
import { assertSeat } from '../cards/deal';
import { prepare } from '../powers/preparation';
import { assertRevision, finishHand } from './lifecycle';
import { playCard } from './play-card';
import type { MatchState, PlayerCommand, Transition } from './types';

export { dealNextHand, startMatch } from './lifecycle';
export type { MatchState, PlayerCommand, PowerSetup, Transition } from './types';

/** Actor seat is resolved by the trusted application, never by a client claim.
 * Revision closes every accepted decision; duplicate delivery cannot score twice.
 * Transport deduplication/ACK replay and match IDs belong to the M2 application.
 */
export function executeCommand(
  state: MatchState,
  expectedRevision: number,
  seat: number,
  command: PlayerCommand,
): Transition {
  assertRevision(state, expectedRevision);
  assertSeat(seat, state.playerCount);
  const team = seat % 2 === 0 ? 'A' : 'B';
  switch (command.type) {
    case 'PREPARE':
      return prepare(state, seat, command.intent);
    case 'PLAY_CARD':
      return playCard(state, seat, command);
    case 'REQUEST_RAISE': {
      if (state.phase.type !== 'TURN') throw new Error('INVALID_PHASE');
      if (state.phase.seat !== seat) throw new Error('NOT_YOUR_TURN');
      if (state.hand.kind !== 'normal') throw new Error('RAISE_DISABLED');
      const betting = requestRaise(state.hand.betting, team, seat);
      return {
        state: {
          ...state,
          revision: state.revision + 1,
          hand: { ...state.hand, betting },
          phase: { type: 'RAISE_RESPONSE' },
        },
        events: [
          {
            type: 'STAKE_CHANGED',
            acceptedStake: betting.acceptedStake,
            pendingStake: betting.pendingStake,
          },
        ],
      };
    }
    case 'RESPOND_RAISE': {
      if (state.phase.type !== 'RAISE_RESPONSE') throw new Error('INVALID_PHASE');
      const resumeSeat = state.hand.betting.resumeTurnSeat;
      if (resumeSeat === null) throw new Error('INVALID_PHASE');
      const result = respondRaise(state.hand.betting, team, command.response);
      if (result.kind === 'fold') return finishHand(state, result.winner, result.reward);
      const { betting } = result;
      return {
        state: {
          ...state,
          revision: state.revision + 1,
          hand: { ...state.hand, betting },
          phase:
            betting.pendingStake === null
              ? { type: 'TURN', seat: resumeSeat }
              : { type: 'RAISE_RESPONSE' },
        },
        events: [
          {
            type: 'STAKE_CHANGED',
            acceptedStake: betting.acceptedStake,
            pendingStake: betting.pendingStake,
          },
        ],
      };
    }
    case 'DECIDE_ELEVEN': {
      if (state.phase.type !== 'ELEVEN_DECISION') throw new Error('INVALID_PHASE');
      if (state.phase.team !== team) throw new Error('NOT_YOUR_DECISION');
      if (command.response === 'fold') return finishHand(state, team === 'A' ? 'B' : 'A', 1);
      if (command.response !== 'play') throw new Error('INVALID_RESPONSE');
      return {
        state: {
          ...state,
          revision: state.revision + 1,
          phase: { type: 'TURN', seat: state.hand.leader },
        },
        events: [],
      };
    }
    default:
      throw new Error('INVALID_COMMAND');
  }
}
