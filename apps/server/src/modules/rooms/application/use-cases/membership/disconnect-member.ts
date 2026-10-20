import { humanConnected } from '../../services/membership/presence';
import type { RoomContext } from '../context';

export async function disconnect(
  context: RoomContext,
  code: string,
  sessionId: string,
  connectionId: string,
): Promise<void> {
  const room = context.rooms.get(code);
  if (!room) return;

  await context.lifecycle.enqueue(room, () => {
    const member = room.state.seats.find((entry) => entry?.sessionId === sessionId);
    if (!member || room.connections.get(member.sessionId)?.id !== connectionId) return;

    context.lifecycle.tick(room);
    room.connections.delete(member.sessionId);
    if (!humanConnected(room)) room.emptySince ??= context.ports.now();
    context.lifecycle.refreshPresence(room);
    context.lifecycle.publish(room);
  });
}
