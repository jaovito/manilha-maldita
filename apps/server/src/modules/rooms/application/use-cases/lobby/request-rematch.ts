import type { Ports } from '../../ports/runtime';
import { beginMatch } from '../../services/match/gameplay';
import type { RoomRuntime } from '../../state/room-runtime';

export function requestRematch(room: RoomRuntime, seat: number, ports: Ports): void {
  if (room.state.status !== 'finished') throw new Error('INVALID_PHASE');
  if (seat !== room.state.hostSeat) throw new Error('NOT_HOST');

  if (room.state.solo) {
    // Admission and match construction must succeed before retiring the previous result.
    beginMatch(room, ports);
  } else {
    room.state.status = 'lobby';
    room.state.match = null;
    room.state.matchId = null;
    room.state.outcome = null;
    room.clock = null;
    room.transition = null;
  }

  for (const occupant of room.state.seats) {
    if (occupant) occupant.ready = false;
  }
}
