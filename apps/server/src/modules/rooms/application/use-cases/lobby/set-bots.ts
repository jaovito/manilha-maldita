import type { Ports } from '../../ports/runtime';
import { humanSeatCount } from '../../services/membership/presence';
import type { RoomRuntime } from '../../state/room-runtime';

/** Lobby membership changes never replace human seats or grant bot identities. */
export function setBots(room: RoomRuntime, seat: number, fill: boolean, ports: Ports): void {
  if (seat !== room.state.hostSeat) throw new Error('NOT_HOST');
  if (room.state.solo) throw new Error('INVALID_COMMAND');
  if (!room.state.botFillEnabled) throw new Error('BOTS_DISABLED');
  if (fill && !room.state.seats.includes(null)) throw new Error('ROOM_FULL');
  if (fill && humanSeatCount(room) < 2) throw new Error('BOT_FILL_NEEDS_PLAYERS');
  if (!fill && !room.state.seats.some((member) => member?.bot)) throw new Error('INVALID_COMMAND');

  room.state.seats = room.state.seats.map((member, index) =>
    fill
      ? (member ?? {
          sessionId: ports.id(),
          nickname: `Bot ${index + 1}`,
          ready: true,
          strikes: 0,
          bot: true,
        })
      : member?.bot
        ? null
        : member,
  );

  for (const member of room.state.seats) {
    if (member) member.ready = member.bot === true;
  }
}
