import type { RoomRuntime } from '../../state/room-runtime';

export function memberSeat(room: RoomRuntime, sessionId: string): number {
  const seat = room.state.seats.findIndex((member) => member?.sessionId === sessionId);
  if (seat < 0) throw new Error('NOT_MEMBER');

  return seat;
}

export function humanConnected(room: RoomRuntime): boolean {
  return room.state.seats.some(
    (member) => !member?.bot && room.connections.has(member?.sessionId ?? ''),
  );
}

export function connected(room: RoomRuntime): boolean[] {
  return room.state.seats.map((member) =>
    member?.bot === true ? humanConnected(room) : room.connections.has(member?.sessionId ?? ''),
  );
}

export function protectionMs(room: RoomRuntime): number {
  return room.state.config.preset === 'competitive' ? 30000 : 60000;
}
