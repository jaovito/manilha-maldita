import type { ClientMessage } from '@truco/game-protocol';
import { applyLobby } from '../lobby/commands';
import { applyGameplay } from '../match/gameplay';
import { resetDevelopmentHand } from '../solo/dev-tools';
import type { Ports, Room } from '../state/types';
import { roomView } from './room-view';

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
  room: Room,
  seat: number,
  message: ClientMessage,
  ports: Ports,
): 'synchronized' | 'changed' {
  if (message.action.type === 'SYNC') {
    room.seats[seat]?.connection?.sink.send({ type: 'SNAPSHOT', room: roomView(room, seat) });
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
