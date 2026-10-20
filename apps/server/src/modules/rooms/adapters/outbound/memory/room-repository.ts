import type { RoomRepository } from '../../../application/ports/room-repository';
import type { RoomRuntime } from '../../../application/state/room-runtime';

export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, RoomRuntime>();

  get size(): number {
    return this.rooms.size;
  }

  get(code: string): RoomRuntime | undefined {
    return this.rooms.get(code);
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }

  values(): IterableIterator<RoomRuntime> {
    return this.rooms.values();
  }

  set(code: string, room: RoomRuntime): void {
    this.rooms.set(code, room);
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }

  clear(): void {
    this.rooms.clear();
  }
}
