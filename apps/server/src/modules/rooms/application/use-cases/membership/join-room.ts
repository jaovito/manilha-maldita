import type { MemberIdentity } from '../../../domain/room';
import { assertSessionCapacity } from '../../services/lobby/creation';
import type { RoomContext } from '../context';

export async function join(
  context: RoomContext,
  code: string,
  sessionId: string,
  nickname: string,
  identity?: MemberIdentity,
): Promise<void> {
  const room = context.lifecycle.getRoom(code);

  await context.lifecycle.enqueue(room, () => {
    context.lifecycle.tick(room);

    if (context.rooms.get(code) !== room) throw new Error('ROOM_NOT_FOUND');
    if (room.state.seats.some((entry) => entry?.sessionId === sessionId)) return;
    if (room.state.solo || room.state.status !== 'lobby') throw new Error('ROOM_CLOSED');
    assertSessionCapacity(context.rooms, sessionId);

    context.validation.nickname(nickname);
    const empty = room.state.seats.indexOf(null);
    const seat = empty < 0 ? room.state.seats.findIndex((member) => member?.bot) : empty;
    if (seat < 0) throw new Error('ROOM_FULL');

    room.state.seats[seat] = {
      sessionId,
      nickname,
      ready: false,
      strikes: 0,
      ...(identity ? { identity: structuredClone(identity) } : {}),
    };
    if (!room.state.seats[room.state.hostSeat] || room.state.seats[room.state.hostSeat]?.bot)
      room.state.hostSeat = seat;

    for (const member of room.state.seats) {
      if (member) member.ready = member.bot === true;
    }
    room.state.revision++;
    context.lifecycle.publish(room);
  });
}
