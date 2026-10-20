import { nextWakeAt, updateConnectivity } from '../../../matches';
import { advanceClock, closeAbnormally } from './match/gameplay';
import { roomView } from '../dto/mappers/room-view';
import type { RoomRepository } from '../ports/room-repository';
import type { Ports } from '../ports/runtime';
import { serializeRoom } from './room-queue';
import { advanceBot, botWakeAt } from './solo/bot';
import { connected, humanConnected, protectionMs } from './membership/presence';
import type { RoomRuntime } from '../state/room-runtime';

/** Lifecycle and timer effects share the exact same authority/queue as player commands. */
export class RoomLifecycle {
  constructor(
    readonly rooms: RoomRepository,
    readonly ports: Ports,
  ) {}

  close(): void {
    const rooms = [...this.rooms.values()];
    this.rooms.clear();

    for (const room of rooms) {
      room.cancel?.();
      for (const member of room.state.seats) {
        try {
          room.connections.get(member?.sessionId ?? '')?.sink.close();
        } catch {}
      }
    }
  }

  getRoom(code: string): RoomRuntime {
    const room = this.rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');

    return room;
  }

  enqueue<T>(room: RoomRuntime, task: () => T): Promise<T> {
    return serializeRoom(room, () => this.rooms.get(room.state.code) === room, task);
  }

  refreshPresence(room: RoomRuntime): void {
    if (room.clock) {
      room.clock = updateConnectivity(room.clock, this.ports.now(), connected(room));
      room.budgets = room.clock.budgets;
    }
  }

  tick(room: RoomRuntime): void {
    if (room.emptySince !== null && this.ports.now() >= room.emptySince + protectionMs(room)) {
      if (room.state.status === 'playing') closeAbnormally(room, null, 'expired');
      room.cancel?.();
      this.rooms.delete(room.state.code);

      return;
    }

    const previousClock = room.clock;
    const advanced = advanceClock(room, this.ports) || advanceBot(room, this.ports);
    if (
      advanced ||
      previousClock?.pausedAt !== room.clock?.pausedAt ||
      previousClock?.deadline !== room.clock?.deadline
    )
      this.publish(room);
    else this.schedule(room);
  }

  publish(room: RoomRuntime): void {
    room.emptySince = humanConnected(room) ? null : (room.emptySince ?? this.ports.now());
    room.sequence++;

    for (const [seat, member] of room.state.seats.entries()) {
      const connection = room.connections.get(member?.sessionId ?? '');
      if (connection) {
        try {
          connection.sink.send({ type: 'SNAPSHOT', room: roomView(room, seat) });
        } catch {
          // A failed recipient cannot roll back an accepted command for the room.
          if (member) room.connections.delete(member.sessionId);
        }
      }
    }

    room.emptySince = humanConnected(room) ? null : (room.emptySince ?? this.ports.now());
    this.refreshPresence(room);
    this.schedule(room);
  }

  schedule(room: RoomRuntime): void {
    room.cancel?.();
    room.cancel = null;

    const times = [
      botWakeAt(room, this.ports),
      room.clock === null ? null : room.clock.expired ? this.ports.now() : nextWakeAt(room.clock),
      room.transition?.until ?? null,
      room.emptySince === null ? null : room.emptySince + protectionMs(room),
    ].filter((at): at is number => at !== null);
    if (times.length === 0 || this.rooms.get(room.state.code) !== room) return;

    const decision = room.clock?.decisionId ?? null;
    const transition = room.transition?.id ?? null;
    room.cancel = this.ports.schedule(Math.min(...times), () => {
      void this.enqueue(room, () => {
        if (
          (room.clock?.decisionId ?? null) !== decision ||
          (room.transition?.id ?? null) !== transition
        )
          return;
        this.tick(room);
      }).catch(() => {});
    });
  }
}
