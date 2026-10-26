import type { Sink } from '../../ports/room-publisher';
import { beginMatch } from '../../services/match/gameplay';
import { memberSeat } from '../../services/membership/presence';
import type { RoomContext } from '../context';

export async function connect(
  context: RoomContext,
  code: string,
  sessionId: string,
  sink: Sink,
): Promise<string> {
  const room = context.lifecycle.getRoom(code);

  return context.lifecycle.enqueue(room, () => {
    context.lifecycle.tick(room);

    if (context.rooms.get(code) !== room) throw new Error('ROOM_NOT_FOUND');

    const seat = memberSeat(room, sessionId);
    const member = room.state.seats[seat];
    if (!member) throw new Error('NOT_MEMBER');

    const previous = room.connections.get(member.sessionId);
    const id = context.ports.id();
    room.connections.set(member.sessionId, { id, sink });

    if (previous) {
      // The retired socket cannot prevent the new authority receiving its snapshot.
      try {
        previous.sink.send({ type: 'ERROR', commandId: null, code: 'CONNECTION_REPLACED' });
      } catch {}
      try {
        previous.sink.close();
      } catch {}
    }

    room.emptySince = null;
    if (room.state.solo && room.state.status === 'lobby') beginMatch(room, context.ports);
    context.lifecycle.refreshPresence(room);
    context.lifecycle.publish(room);

    return id;
  });
}
