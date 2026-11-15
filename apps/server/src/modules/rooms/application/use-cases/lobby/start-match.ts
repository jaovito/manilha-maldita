import type { Ports } from '../../ports/runtime';
import { beginMatch } from '../../services/match/gameplay';
import { humanSeatCount } from '../../services/membership/presence';
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

  // A human can leave after fill, so admission must recheck the multiplayer minimum.
  if (humanSeatCount(room) < 2) throw new Error('BOT_FILL_NEEDS_PLAYERS');

  beginMatch(room, ports);
}
