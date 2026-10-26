import type { CommandReply } from '../dto/commands';
import { commandError } from '../dto/mappers/command-error';
import { roomView } from '../dto/mappers/room-view';
import type { RoomContext } from '../use-cases/context';
import { memberSeat } from './membership/presence';
import { dispatchCommand } from './messaging/dispatch';
import { cacheKey } from './room-queue';

/** All validated commands run here: identity, idempotency and context remain one transaction. */
export async function executeRoomCommand(
  context: RoomContext,
  code: string,
  sessionId: string,
  connectionId: string,
  input: unknown,
  authorized?: () => boolean,
): Promise<CommandReply> {
  const room = context.lifecycle.getRoom(code);

  return context.lifecycle.enqueue(room, () => {
    if (authorized && !authorized()) throw new Error('UNAUTHENTICATED');

    const seat = memberSeat(room, sessionId);
    if (room.connections.get(room.state.seats[seat]?.sessionId ?? '')?.id !== connectionId)
      throw new Error('CONNECTION_REPLACED');

    const message = context.validation.command(input);
    if (!message) return { type: 'ERROR', commandId: null, code: 'INVALID_MESSAGE' };
    const key = cacheKey(sessionId, message);
    const fingerprint = JSON.stringify(message);
    const cached = room.cache.get(key);
    if (cached)
      return cached.fingerprint === fingerprint
        ? cached.reply
        : { type: 'ERROR', commandId: message.commandId, code: 'COMMAND_ID_REUSED' };

    context.lifecycle.tick(room);

    if (context.rooms.get(code) !== room) throw new Error('ROOM_NOT_FOUND');

    let reply: CommandReply;
    try {
      const result = dispatchCommand(room, seat, message, context.ports);
      if (result === 'changed') context.lifecycle.publish(room);

      reply = { type: 'ACK', commandId: message.commandId, ok: true, sequence: room.sequence };
    } catch (error) {
      reply = {
        type: 'ERROR',
        commandId: message.commandId,
        code: commandError(error),
      };
      room.connections
        .get(room.state.seats[seat]?.sessionId ?? '')
        ?.sink.send({ type: 'SNAPSHOT', room: roomView(room, seat) });
    }

    room.cache.set(key, { fingerprint, reply });
    if (room.cache.size > 512) {
      const oldest = room.cache.keys().next().value;
      if (oldest !== undefined) room.cache.delete(oldest);
    }

    return reply;
  });
}
