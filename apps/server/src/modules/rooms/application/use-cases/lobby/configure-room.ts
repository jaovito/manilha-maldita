import { normalizeConfig } from '../../../domain/configuration';
import type { RoomConfig } from '../../../domain/room';
import type { RoomRuntime } from '../../state/room-runtime';

export function configureRoom(room: RoomRuntime, seat: number, input: RoomConfig): void {
  if (seat !== room.state.hostSeat) throw new Error('NOT_HOST');

  const config = normalizeConfig(input);
  const count = config.format === '1v1' ? 2 : 4;
  if (room.state.seats.slice(count).some((entry) => entry !== null)) throw new Error('ROOM_FULL');

  room.state.seats = Array.from({ length: count }, (_, index) => room.state.seats[index] ?? null);
  room.state.config = config;
  for (const occupant of room.state.seats) {
    if (occupant) occupant.ready = false;
  }
}
