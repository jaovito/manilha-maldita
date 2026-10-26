import type { RoomCommand } from '../../dto/commands';
import type { Ports } from '../../ports/runtime';
import type { RoomRuntime } from '../../state/room-runtime';
import { changeSeat } from '../../use-cases/lobby/change-seat';
import { configureRoom } from '../../use-cases/lobby/configure-room';
import { leaveRoom } from '../../use-cases/lobby/leave-room';
import { requestRematch } from '../../use-cases/lobby/request-rematch';
import { setReady } from '../../use-cases/lobby/set-ready';
import { startRoomMatch } from '../../use-cases/lobby/start-match';

/** Shared concurrency preconditions precede every lobby mutation. */
export function applyLobby(
  room: RoomRuntime,
  seat: number,
  message: RoomCommand,
  ports: Ports,
): void {
  if (message.matchId !== room.state.matchId || message.decisionId !== null)
    throw new Error('STALE_CONTEXT');
  if (message.expectedRevision !== room.state.revision) throw new Error('STALE_REVISION');
  if (!room.state.seats[seat]) throw new Error('NOT_MEMBER');

  const action = message.action;
  if (action.type === 'REMATCH') requestRematch(room, seat, ports);
  else if (action.type === 'LEAVE') leaveRoom(room, seat);
  else {
    if (room.state.status !== 'lobby') throw new Error('INVALID_PHASE');
    if (room.state.solo && (action.type === 'SET_SEAT' || action.type === 'CONFIGURE'))
      throw new Error('INVALID_COMMAND');
    switch (action.type) {
      case 'READY':
        setReady(room, seat, action.ready);
        break;
      case 'SET_SEAT':
        changeSeat(room, seat, action.seat);
        break;
      case 'CONFIGURE':
        configureRoom(room, seat, action.config);
        break;
      case 'START_MATCH':
        startRoomMatch(room, seat, ports);
        break;
      default:
        throw new Error('INVALID_COMMAND');
    }
  }

  room.state.revision++;
}
