import type { RoomRuntime } from '../../state/room-runtime';

export function setReady(room: RoomRuntime, seat: number, ready: boolean): void {
  const member = room.state.seats[seat];
  if (!member) throw new Error('NOT_MEMBER');
  member.ready = ready;
}
