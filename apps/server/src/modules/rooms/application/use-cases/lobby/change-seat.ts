import type { RoomRuntime } from '../../state/room-runtime';

export function changeSeat(room: RoomRuntime, seat: number, target: number): void {
  if (target >= room.state.seats.length || target < 0 || !Number.isInteger(target))
    throw new Error('INVALID_SEAT');
  if (target === seat) return;
  if (room.state.seats[target] != null) throw new Error('SEAT_TAKEN');

  room.state.seats[target] = room.state.seats[seat] ?? null;
  room.state.seats[seat] = null;
  if (room.state.hostSeat === seat) room.state.hostSeat = target;
  for (const occupant of room.state.seats) {
    if (occupant) occupant.ready = false;
  }
}
