import { projectPlayerView } from '@truco/game-core/projections';
import type { MemberIdentity } from '../../../domain/room';
import type { RoomRuntime } from '../../state/room-runtime';
import type { RoomView } from '../room-snapshot';

export function roomView(room: RoomRuntime, selfSeat: number): RoomView {
  const identityAt = (seat: number): MemberIdentity | undefined =>
    room.state.status === 'lobby'
      ? room.state.seats[seat]?.identity
      : room.matchRecord?.seats[seat]?.identity;
  const ownAppearance = identityAt(selfSeat)?.appearance;

  const participant = room.matchRecord?.seats[selfSeat];
  const rewardEligibility = participant?.accountId
    ? ('eligible' as const)
    : participant?.identity
      ? ('development' as const)
      : ('guest' as const);

  return {
    ...(room.state.status === 'finished' &&
    room.matchRecord &&
    room.matchRecord.policyVersion !== 'disabled'
      ? { rewardEligibility }
      : {}),
    code: room.state.code,
    ...(ownAppearance ? { tableTheme: { ...ownAppearance.table } } : {}),
    ...(room.state.solo ? { solo: true, devTools: room.state.devTools === true } : {}),
    sequence: room.sequence,
    roomRevision: room.state.revision,
    status: room.state.status,
    hostSeat: room.state.hostSeat,
    selfSeat,
    config: { ...room.state.config },
    seats: room.state.seats.map((member, seat) => {
      const appearance = identityAt(seat)?.appearance;

      return member === null
        ? null
        : {
            seat,
            nickname: member.nickname,
            connected: member.bot === true || room.connections.has(member.sessionId),
            ready: member.ready,
            ...(appearance
              ? {
                  appearance: {
                    avatar: { ...appearance.avatar },
                    deck: { ...appearance.deck },
                  },
                }
              : {}),
          };
    }),
    matchId: room.state.matchId,
    decisionId: room.clock?.decisionId ?? null,
    deadline: room.clock?.deadline ?? null,
    paused: room.clock?.pausedAt != null,
    ...(room.transition === null ? {} : { transition: { ...room.transition } }),
    match: room.state.match === null ? null : projectPlayerView(room.state.match, selfSeat),
    outcome: room.state.outcome === null ? null : { ...room.state.outcome },
  };
}
