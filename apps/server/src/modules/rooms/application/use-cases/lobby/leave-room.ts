import type { RoomRuntime } from '../../state/room-runtime';

export function leaveRoom(room: RoomRuntime, seat: number): void {
  if (room.state.status === 'playing') throw new Error('INVALID_PHASE');

  const member = room.state.seats[seat];
  if (member) room.connections.delete(member.sessionId);
  room.state.seats[seat] = null;
  if (room.state.hostSeat === seat)
    room.state.hostSeat = Math.max(
      0,
      room.state.seats.findIndex((entry) => entry !== null),
    );
  for (const occupant of room.state.seats) {
    if (occupant) occupant.ready = false;
  }
}
