import { executeCommand } from '@truco/game-core/match';
import type { Action, RoomCommand } from '../../dto/commands';
import { closeAbnormally } from '../../services/match/gameplay';
import { settleGameplay } from '../../services/match/transitions';
import type { Ports } from '../../ports/runtime';
import type { RoomRuntime } from '../../state/room-runtime';
import { prepareHand } from './prepare-hand';

/** Execute a player decision atomically, then settle timers/transitions from the accepted state. */
export function applyGameplay(
  room: RoomRuntime,
  seat: number,
  message: RoomCommand,
  ports: Ports,
): void {
  const state = room.state.match;

  if (room.state.status !== 'playing' || state === null) throw new Error('INVALID_PHASE');
  if (
    message.matchId !== room.state.matchId ||
    message.decisionId !== (room.clock?.decisionId ?? null)
  )
    throw new Error('STALE_CONTEXT');
  if (message.action.type !== 'PREPARE' && message.expectedRevision !== state.revision)
    throw new Error('STALE_REVISION');

  if (message.action.type === 'SURRENDER') {
    closeAbnormally(room, seat % 2 === 0 ? 'B' : 'A', 'surrender');

    return;
  }

  if (room.transition !== null) throw new Error('DECISION_PAUSED');

  if (
    message.action.type !== 'PREPARE' &&
    room.clock?.pausedAt !== null &&
    room.clock?.pausedAt !== undefined
  )
    throw new Error('DECISION_PAUSED');

  const action: Action = message.action;
  // The discriminated cases below prevent lobby/transport actions entering the core.
  switch (action.type) {
    case 'PREPARE':
      prepareHand(room, state, seat, action, ports);
      break;
    case 'PLAY_CARD':
      room.state.match = executeCommand(state, state.revision, seat, action).state;
      break;
    case 'REQUEST_RAISE':
    case 'RESPOND_RAISE':
    case 'DECIDE_ELEVEN':
      room.state.match = executeCommand(state, state.revision, seat, action).state;
      break;
    default:
      throw new Error('INVALID_COMMAND');
  }

  const member = room.state.seats[seat];
  if (member) member.strikes = 0;

  if (
    !(
      state.phase.type === 'PREPARATION' &&
      room.state.match?.phase.type === 'PREPARATION' &&
      room.clock
    )
  )
    settleGameplay(room, state, ports);
}
