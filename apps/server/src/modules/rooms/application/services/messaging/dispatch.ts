import type { RoomCommand } from '../../dto/commands';
import { applyLobby } from '../lobby/commands';
import type { Ports } from '../../ports/runtime';
import { resetDevelopmentHand } from '../../use-cases/solo/reset-development-hand';
import type { RoomRuntime } from '../../state/room-runtime';
import { applyGameplay } from '../../use-cases/match/execute-gameplay';
import { roomView } from '../../dto/mappers/room-view';

const LOBBY_ACTIONS = new Set([
  'READY',
  'SET_SEAT',
  'CONFIGURE',
  'START_MATCH',
  'REMATCH',
  'LEAVE',
]);

/** Called inside the room queue, after identity, cache and expiration checks. */
export function dispatchCommand(
  room: RoomRuntime,
  seat: number,
  message: RoomCommand,
  ports: Ports,
): 'synchronized' | 'changed' {
  if (message.action.type === 'SYNC') {
    room.connections
      .get(room.state.seats[seat]?.sessionId ?? '')
      ?.sink.send({ type: 'SNAPSHOT', room: roomView(room, seat) });
    return 'synchronized';
  }

  if (message.action.type === 'DEV_RESET_HAND') {
    resetDevelopmentHand(room, seat, message, ports);
  } else if (LOBBY_ACTIONS.has(message.action.type)) {
    applyLobby(room, seat, message, ports);
  } else {
    applyGameplay(room, seat, message, ports);
  }

  return 'changed';
}
