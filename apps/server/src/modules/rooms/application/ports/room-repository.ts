import type { RoomRuntime } from '../state/room-runtime';

/** Stores the live authority, not detached copies: all writers share its queue. */
export interface RoomRepository {
  readonly size: number;
  get(code: string): RoomRuntime | undefined;
  has(code: string): boolean;
  values(): IterableIterator<RoomRuntime>;
  set(code: string, room: RoomRuntime): void;
  delete(code: string): void;
  clear(): void;
}
