import { executeCommand, type MatchState, type PlayerCommand } from '@truco/game-core/match';
import { updateConnectivity } from '../../../../matches';
import type { Ports } from '../../ports/runtime';
import { connected } from '../../services/membership/presence';
import type { RoomRuntime } from '../../state/room-runtime';

/** Commit privately and retain the shared preparation deadline while other players decide. */
export function prepareHand(
  room: RoomRuntime,
  state: MatchState,
  seat: number,
  action: Extract<PlayerCommand, { type: 'PREPARE' }>,
  ports: Ports,
): void {
  room.state.match = executeCommand(state, state.revision, seat, action).state;
  if (
    state.phase.type === 'PREPARATION' &&
    room.state.match.phase.type === 'PREPARATION' &&
    room.clock
  ) {
    room.clock = updateConnectivity(
      {
        ...room.clock,
        dependencies: room.state.seats.flatMap((_, owner) =>
          room.state.match?.powers?.commitments[owner] === null ? [owner] : [],
        ),
      },
      ports.now(),
      connected(room),
    );
    room.budgets = room.clock.budgets;
  }
}
