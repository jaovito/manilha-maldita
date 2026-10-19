import type { Room } from './types';

export function memberSeat(room: Room, sessionId: string): number {
  const seat = room.seats.findIndex((member) => member?.sessionId === sessionId);
  if (seat < 0) throw new Error('NOT_MEMBER');

  return seat;
}

export function humanConnected(room: Room): boolean {
  return room.seats.some((member) => !member?.bot && member?.connection != null);
}

export function connected(room: Room): boolean[] {
  return room.seats.map((member) =>
    member?.bot === true ? humanConnected(room) : member?.connection != null,
  );
}

export function protectionMs(room: Room): number {
  return room.config.preset === 'competitive' ? 30000 : 60000;
}
