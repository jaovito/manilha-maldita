import type { RoomRuntime } from '../../state/room-runtime';

export function requestRematch(room: RoomRuntime, seat: number): void {
  if (room.state.status !== 'finished') throw new Error('INVALID_PHASE');
  if (seat !== room.state.hostSeat) throw new Error('NOT_HOST');

  room.state.status = 'lobby';
  room.state.match = null;
  room.state.matchId = null;
  room.state.outcome = null;
  room.clock = null;
  room.transition = null;
  for (const occupant of room.state.seats) {
    if (occupant) occupant.ready = false;
  }
}
