import { normalizeConfig, type ClientMessage } from '@truco/game-protocol';
import { beginMatch } from './gameplay';
import type { Ports, Room } from './types';

export function applyLobby(room: Room, seat: number, message: ClientMessage, ports: Ports): void {
  if (message.matchId !== room.matchId || message.decisionId !== null)
    throw new Error('STALE_CONTEXT');
  if (message.expectedRevision !== room.revision) throw new Error('STALE_REVISION');
  const member = room.seats[seat];
  if (!member) throw new Error('NOT_MEMBER');
  const action = message.action;
  if (action.type === 'REMATCH') {
    if (room.status !== 'finished') throw new Error('INVALID_PHASE');
    if (seat !== room.hostSeat) throw new Error('NOT_HOST');
    room.status = 'lobby';
    room.match = null;
    room.matchId = null;
    room.outcome = null;
    room.clock = null;
    for (const occupant of room.seats) if (occupant) occupant.ready = false;
  } else if (action.type === 'LEAVE') {
    if (room.status === 'playing') throw new Error('INVALID_PHASE');
    room.seats[seat] = null;
    if (room.hostSeat === seat)
      room.hostSeat = Math.max(
        0,
        room.seats.findIndex((entry) => entry !== null),
      );
    for (const occupant of room.seats) if (occupant) occupant.ready = false;
  } else {
    if (room.status !== 'lobby') throw new Error('INVALID_PHASE');
    switch (action.type) {
      case 'READY':
        member.ready = action.ready;
        break;
      case 'SET_SEAT': {
        if (action.seat >= room.seats.length || action.seat < 0 || !Number.isInteger(action.seat))
          throw new Error('INVALID_SEAT');
        if (action.seat === seat) break;
        const other = room.seats[action.seat] ?? null;
        if (other !== null) throw new Error('SEAT_TAKEN');

        room.seats[action.seat] = member;
        room.seats[seat] = null;
        if (room.hostSeat === seat) room.hostSeat = action.seat;
        for (const occupant of room.seats) if (occupant) occupant.ready = false;
        break;
      }
      case 'CONFIGURE': {
        if (seat !== room.hostSeat) throw new Error('NOT_HOST');
        const config = normalizeConfig(action.config);
        const count = config.format === '1v1' ? 2 : 4;
        if (room.seats.slice(count).some((entry) => entry !== null)) throw new Error('ROOM_FULL');
        room.seats = Array.from({ length: count }, (_, index) => room.seats[index] ?? null);
        room.config = config;
        for (const occupant of room.seats) if (occupant) occupant.ready = false;
        break;
      }
      case 'START_MATCH':
        if (seat !== room.hostSeat) throw new Error('NOT_HOST');
        if (room.seats.some((occupant) => !occupant?.ready || occupant.connection === null))
          throw new Error('NOT_READY');
        beginMatch(room, ports);
        break;
      default:
        throw new Error('INVALID_COMMAND');
    }
  }
  room.revision++;
}
