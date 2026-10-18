import {
  clientMessageSchema,
  nicknameSchema,
  normalizeConfig,
  type ClientMessage,
  type CommandReply,
  type RoomConfig,
} from '@truco/game-protocol';
import { nextWakeAt, updateConnectivity } from '../../matches';
import { advanceClock, applyGameplay, closeAbnormally } from './gameplay';
import { applyLobby } from './lobby';
import { commandError } from './command-error';
import { roomView } from './room-view';
import { serializeRoom } from './room-queue';
import {
  type Room,
  type Ports,
  type Sink,
  cacheKey,
  connected,
  memberSeat,
  protectionMs,
} from './types';

const LOBBY_ACTIONS = new Set([
  'READY',
  'SET_SEAT',
  'CONFIGURE',
  'START_MATCH',
  'REMATCH',
  'LEAVE',
]);

/** One queue owns lobby, presence, gameplay, timers and rematches in each room. */
export class RoomService {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly ports: Ports) {}

  async create(sessionId: string, nickname: string, input: RoomConfig): Promise<{ code: string }> {
    if (this.rooms.size >= 256) throw new Error('ROOM_CAPACITY');
    if (
      [...this.rooms.values()].filter((room) =>
        room.seats.some((member) => member?.sessionId === sessionId),
      ).length >= 3
    )
      throw new Error('SESSION_CAPACITY');

    nicknameSchema.parse(nickname);
    const config = normalizeConfig(input);
    let code = '';
    for (let attempt = 0; attempt < 16; attempt++) {
      code = Array.from(
        { length: 6 },
        () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[this.ports.randomInt(32)],
      ).join('');
      if (!this.rooms.has(code)) break;
    }
    if (this.rooms.has(code)) throw new Error('ROOM_CAPACITY');

    const room: Room = {
      code,
      config,
      sequence: 0,
      revision: 0,
      hostSeat: 0,
      seats: Array.from({ length: config.format === '1v1' ? 2 : 4 }, (_, seat) =>
        seat === 0 ? { sessionId, nickname, ready: false, connection: null, strikes: 0 } : null,
      ),
      status: 'lobby',
      match: null,
      matchId: null,
      outcome: null,
      clock: null,
      transition: null,
      budgets: [],
      emptySince: this.ports.now(),
      cache: new Map(),
      chain: Promise.resolve(),
      pending: 0,
      cancel: null,
    };

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
      if (room.status !== 'lobby') throw new Error('ROOM_CLOSED');
      if (
        [...this.rooms.values()].filter((entry) =>
          entry.seats.some((member) => member?.sessionId === sessionId),
        ).length >= 3
      )
        throw new Error('SESSION_CAPACITY');

      nicknameSchema.parse(nickname);
      const seat = room.seats.indexOf(null);
      if (seat < 0) throw new Error('ROOM_FULL');
      room.seats[seat] = { sessionId, nickname, ready: false, connection: null, strikes: 0 };
      for (const member of room.seats) if (member) member.ready = false;
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
      if (!connected(room).some(Boolean)) room.emptySince ??= this.ports.now();
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
        if (message.action.type === 'SYNC') {
          room.seats[seat]?.connection?.sink.send({ type: 'SNAPSHOT', room: roomView(room, seat) });
        } else if (LOBBY_ACTIONS.has(message.action.type)) {
          applyLobby(room, seat, message, this.ports);
          this.publish(room);
        } else {
          applyGameplay(room, seat, message, this.ports);
          this.publish(room);
        }
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
    const advanced = advanceClock(room, this.ports);
    if (
      advanced ||
      previousClock?.pausedAt !== room.clock?.pausedAt ||
      previousClock?.deadline !== room.clock?.deadline
    )
      this.publish(room);
    else this.schedule(room);
  }

  private publish(room: Room): void {
    room.emptySince = connected(room).some(Boolean) ? null : (room.emptySince ?? this.ports.now());
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
    room.emptySince = connected(room).some(Boolean) ? null : (room.emptySince ?? this.ports.now());
    this.refreshPresence(room);
    this.schedule(room);
  }

  private schedule(room: Room): void {
    room.cancel?.();
    room.cancel = null;
    const times = [
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
