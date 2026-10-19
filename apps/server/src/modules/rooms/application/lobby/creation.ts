import { nicknameSchema, normalizeConfig, type RoomConfig } from '@truco/game-protocol';
import type { Ports, Room, RoomOptions } from '../state/types';

export function assertSessionCapacity(rooms: ReadonlyMap<string, Room>, sessionId: string): void {
  const memberships = [...rooms.values()].filter((room) =>
    room.seats.some((member) => member?.sessionId === sessionId),
  ).length;

  if (memberships >= 3) throw new Error('SESSION_CAPACITY');
}

/** Construct privately; RoomService registers the room and schedules it synchronously. */
export function createRoom(
  request: { sessionId: string; nickname: string; config: RoomConfig; solo: boolean },
  rooms: ReadonlyMap<string, Room>,
  ports: Ports,
  options: RoomOptions,
): Room {
  const { sessionId, nickname, config: input, solo } = request;

  if (solo && !options.soloEnabled) throw new Error('SOLO_DISABLED');
  if (rooms.size >= 256) throw new Error('ROOM_CAPACITY');
  assertSessionCapacity(rooms, sessionId);

  nicknameSchema.parse(nickname);
  const config = normalizeConfig(solo ? { ...input, format: '1v1' } : input);

  let code = '';

  for (let attempt = 0; attempt < 16; attempt++) {
    code = Array.from(
      { length: 6 },
      () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[ports.randomInt(32)],
    ).join('');
    if (!rooms.has(code)) break;
  }

  if (rooms.has(code)) throw new Error('ROOM_CAPACITY');

  const room: Room = {
    code,
    solo,
    devTools: solo && options.devTools === true,
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
    emptySince: ports.now(),
    cache: new Map(),
    chain: Promise.resolve(),
    pending: 0,
    cancel: null,
  };

  if (solo) {
    room.seats[1] = {
      sessionId: ports.id(),
      nickname: 'Bot Treino',
      ready: true,
      connection: null,
      strikes: 0,
      bot: true,
    };
  }

  return room;
}
