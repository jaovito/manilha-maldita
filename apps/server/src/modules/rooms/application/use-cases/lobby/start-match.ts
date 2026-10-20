import { beginMatch } from '../../services/match/gameplay';
import type { Ports } from '../../ports/runtime';
import type { RoomRuntime } from '../../state/room-runtime';

export function startRoomMatch(room: RoomRuntime, seat: number, ports: Ports): void {
  if (seat !== room.state.hostSeat) throw new Error('NOT_HOST');
  if (
    room.state.seats.some(
      (occupant) =>
        !occupant?.ready || (!occupant.bot && !room.connections.has(occupant.sessionId)),
    )
  )
    throw new Error('NOT_READY');

  beginMatch(room, ports);
}
