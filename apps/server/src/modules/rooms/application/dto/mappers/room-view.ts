import { projectPlayerView } from '@truco/game-core/projections';
import type { RoomView } from '../room-snapshot';
import type { RoomRuntime } from '../../state/room-runtime';

export function roomView(room: RoomRuntime, selfSeat: number): RoomView {
  return {
    code: room.state.code,
    ...(room.state.solo ? { solo: true, devTools: room.state.devTools === true } : {}),
    sequence: room.sequence,
    roomRevision: room.state.revision,
    status: room.state.status,
    hostSeat: room.state.hostSeat,
    selfSeat,
    config: { ...room.state.config },
    seats: room.state.seats.map((member, seat) =>
      member === null
        ? null
        : {
            seat,
            nickname: member.nickname,
            connected: member.bot === true || room.connections.has(member.sessionId),
            ready: member.ready,
          },
    ),
    matchId: room.state.matchId,
    decisionId: room.clock?.decisionId ?? null,
    deadline: room.clock?.deadline ?? null,
    paused: room.clock?.pausedAt != null,
    ...(room.transition === null ? {} : { transition: { ...room.transition } }),
    match: room.state.match === null ? null : projectPlayerView(room.state.match, selfSeat),
    outcome: room.state.outcome === null ? null : { ...room.state.outcome },
  };
}
