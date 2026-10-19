import { projectPlayerView } from '@truco/game-core/projections';
import type { RoomView } from '@truco/game-protocol';
import type { Room } from '../state/types';

export function roomView(room: Room, selfSeat: number): RoomView {
  return {
    code: room.code,
    ...(room.solo ? { solo: true, devTools: room.devTools === true } : {}),
    sequence: room.sequence,
    roomRevision: room.revision,
    status: room.status,
    hostSeat: room.hostSeat,
    selfSeat,
    config: { ...room.config },
    seats: room.seats.map((member, seat) =>
      member === null
        ? null
        : {
            seat,
            nickname: member.nickname,
            connected: member.bot === true || member.connection !== null,
            ready: member.ready,
          },
    ),
    matchId: room.matchId,
    decisionId: room.clock?.decisionId ?? null,
    deadline: room.clock?.deadline ?? null,
    paused: room.clock?.pausedAt != null,
    ...(room.transition === null ? {} : { transition: { ...room.transition } }),
    match: room.match === null ? null : projectPlayerView(room.match, selfSeat),
    outcome: room.outcome === null ? null : { ...room.outcome },
  };
}
