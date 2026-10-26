import { normalizeConfig } from '../../../domain/configuration';
import type { MemberIdentity, RoomConfig } from '../../../domain/room';
import type { RoomInputValidation } from '../../ports/input-validation';
import type { RoomRepository } from '../../ports/room-repository';
import type { Ports, RoomOptions } from '../../ports/runtime';
import type { RoomRuntime } from '../../state/room-runtime';

export function assertSessionCapacity(rooms: RoomRepository, sessionId: string): void {
  const memberships = [...rooms.values()].filter((room) =>
    room.state.seats.some((member) => member?.sessionId === sessionId),
  ).length;

  if (memberships >= 3) throw new Error('SESSION_CAPACITY');
}

/** Construct privately; the creation use case registers the room and schedules it synchronously. */
export function createRoom(
  request: {
    sessionId: string;
    nickname: string;
    config: RoomConfig;
    solo: boolean;
    identity?: MemberIdentity;
  },
  rooms: RoomRepository,
  ports: Ports,
  options: RoomOptions,
  validation: RoomInputValidation,
): RoomRuntime {
  const { sessionId, nickname, config: input, solo, identity } = request;

  if (solo && !options.soloEnabled) throw new Error('SOLO_DISABLED');
  if (rooms.size >= 256) throw new Error('ROOM_CAPACITY');
  assertSessionCapacity(rooms, sessionId);

  validation.nickname(nickname);
  const config = normalizeConfig(
    validation.configuration(solo ? { ...input, format: '1v1' } : input),
  );

  let code = '';

  for (let attempt = 0; attempt < 16; attempt++) {
    code = Array.from(
      { length: 6 },
      () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[ports.randomInt(32)],
    ).join('');
    if (!rooms.has(code)) break;
  }

  if (rooms.has(code)) throw new Error('ROOM_CAPACITY');

  const room: RoomRuntime = {
    state: {
      code,
      solo,
      devTools: solo && options.devTools === true,
      config,
      revision: 0,
      hostSeat: 0,
      seats: Array.from({ length: config.format === '1v1' ? 2 : 4 }, (_, seat) =>
        seat === 0
          ? {
              sessionId,
              nickname,
              ready: false,
              strikes: 0,
              ...(identity ? { identity: structuredClone(identity) } : {}),
            }
          : null,
      ),
      status: 'lobby',
      match: null,
      matchId: null,
      outcome: null,
    },
    sequence: 0,
    connections: new Map(),
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
    room.state.seats[1] = {
      sessionId: ports.id(),
      nickname: 'Bot Treino',
      ready: true,
      strikes: 0,
      bot: true,
    };
  }

  return room;
}
