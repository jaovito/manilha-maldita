import {
  clientMessageSchema,
  nicknameSchema,
  type ClientMessage,
  type CommandReply,
  type RoomConfig,
} from '@truco/game-protocol';
import { nextWakeAt, updateConnectivity } from '../../matches';
import { advanceBot, botWakeAt } from './solo/bot';
import { advanceClock, beginMatch, closeAbnormally } from './match/gameplay';
import { dispatchCommand } from './messaging/dispatch';
import { commandError } from './messaging/command-error';
import { roomView } from './messaging/room-view';
import { serializeRoom, cacheKey } from './room-queue';
import { createRoom, assertSessionCapacity } from './lobby/creation';
import type { Room, Ports, Sink, RoomOptions } from './state/types';
import { connected, humanConnected, memberSeat, protectionMs } from './state/presence';

/** One queue owns lobby, presence, gameplay, timers and rematches in each room. */
export class RoomService {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly ports: Ports,
    private readonly options: RoomOptions = {},
  ) {}

  async create(
    sessionId: string,
    nickname: string,
    input: RoomConfig,
    solo = false,
  ): Promise<{ code: string }> {
    const room = createRoom(
      { sessionId, nickname, config: input, solo },
      this.rooms,
      this.ports,
      this.options,
    );
    const { code } = room;

    this.rooms.set(code, room);
    this.schedule(room);

    return { code };
  }

  async join(code: string, sessionId: string, nickname: string): Promise<void> {
    const room = this.getRoom(code);

    await this.enqueue(room, () => {
      this.tick(room);

      if (this.rooms.get(code) !== room) throw new Error('ROOM_NOT_FOUND');
      if (room.seats.some((entry) => entry?.sessionId === sessionId)) return;
      if (room.solo || room.status !== 'lobby') throw new Error('ROOM_CLOSED');
      assertSessionCapacity(this.rooms, sessionId);

      nicknameSchema.parse(nickname);
      const seat = room.seats.indexOf(null);
      if (seat < 0) throw new Error('ROOM_FULL');

      room.seats[seat] = { sessionId, nickname, ready: false, connection: null, strikes: 0 };
      for (const member of room.seats) {
        if (member) member.ready = false;
      }
      room.revision++;
      this.publish(room);
    });
  }

  async connect(code: string, sessionId: string, sink: Sink): Promise<string> {
    const room = this.getRoom(code);

    return this.enqueue(room, () => {
      this.tick(room);

      if (this.rooms.get(code) !== room) throw new Error('ROOM_NOT_FOUND');

      const seat = memberSeat(room, sessionId);
      const member = room.seats[seat];
      if (!member) throw new Error('NOT_MEMBER');

      const previous = member.connection;
      const id = this.ports.id();
      member.connection = { id, sink };

      if (previous) {
        // The retired socket cannot prevent the new authority receiving its snapshot.
        try {
          previous.sink.send({ type: 'ERROR', commandId: null, code: 'CONNECTION_REPLACED' });
        } catch {}
        try {
          previous.sink.close();
        } catch {}
      }

      room.emptySince = null;
      if (room.solo && room.status === 'lobby') beginMatch(room, this.ports);
      this.refreshPresence(room);
      this.publish(room);

      return id;
    });
  }

  async disconnect(code: string, sessionId: string, connectionId: string): Promise<void> {
    const room = this.rooms.get(code);
    if (!room) return;

    await this.enqueue(room, () => {
      const member = room.seats.find((entry) => entry?.sessionId === sessionId);
      if (member?.connection?.id !== connectionId) return;

      this.tick(room);
      member.connection = null;
      if (!humanConnected(room)) room.emptySince ??= this.ports.now();
      this.refreshPresence(room);
      this.publish(room);
    });
  }

  async receive(
    code: string,
    sessionId: string,
    connectionId: string,
    input: ClientMessage,
  ): Promise<CommandReply> {
    const room = this.getRoom(code);

    return this.enqueue(room, () => {
      const seat = memberSeat(room, sessionId);
      if (room.seats[seat]?.connection?.id !== connectionId) throw new Error('CONNECTION_REPLACED');

      const parsed = clientMessageSchema.safeParse(input);
      if (!parsed.success) return { type: 'ERROR', commandId: null, code: 'INVALID_MESSAGE' };

      const message = parsed.data;
      const key = cacheKey(sessionId, message);
      const fingerprint = JSON.stringify(message);
      const cached = room.cache.get(key);
      if (cached)
        return cached.fingerprint === fingerprint
          ? cached.reply
          : { type: 'ERROR', commandId: message.commandId, code: 'COMMAND_ID_REUSED' };

      this.tick(room);

      if (this.rooms.get(code) !== room) throw new Error('ROOM_NOT_FOUND');

      let reply: CommandReply;
      try {
        const result = dispatchCommand(room, seat, message, this.ports);
        if (result === 'changed') this.publish(room);

        reply = { type: 'ACK', commandId: message.commandId, ok: true, sequence: room.sequence };
      } catch (error) {
        reply = {
          type: 'ERROR',
          commandId: message.commandId,
          code: commandError(error),
        };
        room.seats[seat]?.connection?.sink.send({ type: 'SNAPSHOT', room: roomView(room, seat) });
      }

      room.cache.set(key, { fingerprint, reply });
      if (room.cache.size > 512) {
        const oldest = room.cache.keys().next().value;
        if (oldest !== undefined) room.cache.delete(oldest);
      }

      return reply;
    });
  }

  close(): void {
    const rooms = [...this.rooms.values()];
    this.rooms.clear();

    for (const room of rooms) {
      room.cancel?.();
      for (const member of room.seats) {
        try {
          member?.connection?.sink.close();
        } catch {}
      }
    }
  }

  private getRoom(code: string): Room {
    const room = this.rooms.get(code);
    if (!room) throw new Error('ROOM_NOT_FOUND');

    return room;
  }

  private enqueue<T>(room: Room, task: () => T): Promise<T> {
    return serializeRoom(room, () => this.rooms.get(room.code) === room, task);
  }

  private refreshPresence(room: Room): void {
    if (room.clock) {
      room.clock = updateConnectivity(room.clock, this.ports.now(), connected(room));
      room.budgets = room.clock.budgets;
    }
  }

  private tick(room: Room): void {
    if (room.emptySince !== null && this.ports.now() >= room.emptySince + protectionMs(room)) {
      if (room.status === 'playing') closeAbnormally(room, null, 'expired');
      room.cancel?.();
      this.rooms.delete(room.code);

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

  private publish(room: Room): void {
    room.emptySince = humanConnected(room) ? null : (room.emptySince ?? this.ports.now());
    room.sequence++;

    for (const [seat, member] of room.seats.entries()) {
      const connection = member?.connection;
      if (connection) {
        try {
          connection.sink.send({ type: 'SNAPSHOT', room: roomView(room, seat) });
        } catch {
          // A failed recipient cannot roll back an accepted command for the room.
          if (member) member.connection = null;
        }
      }
    }

    room.emptySince = humanConnected(room) ? null : (room.emptySince ?? this.ports.now());
    this.refreshPresence(room);
    this.schedule(room);
  }

  private schedule(room: Room): void {
    room.cancel?.();
    room.cancel = null;

    const times = [
      botWakeAt(room, this.ports),
      room.clock === null ? null : room.clock.expired ? this.ports.now() : nextWakeAt(room.clock),
      room.transition?.until ?? null,
      room.emptySince === null ? null : room.emptySince + protectionMs(room),
    ].filter((at): at is number => at !== null);
    if (times.length === 0 || this.rooms.get(room.code) !== room) return;

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
