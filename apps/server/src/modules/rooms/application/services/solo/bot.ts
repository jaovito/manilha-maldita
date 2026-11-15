import { projectPlayerView } from '@truco/game-core/projections';
import { chooseAction } from '@truco/game-sim';
import type { Ports } from '../../ports/runtime';
import type { RoomRuntime } from '../../state/room-runtime';
import { applyGameplay } from '../../use-cases/match/execute-gameplay';
import { humanConnected } from '../membership/presence';

const THINK_MS = 1000;

/** Only projected information crosses the policy boundary. Timers share the room queue. */
export function botWakeAt(room: RoomRuntime, ports: Ports): number | null {
  const { clock } = room;
  const state = room.state.match;
  const seat = clock?.dependencies.find((index) => room.state.seats[index]?.bot);
  if (
    room.state.status !== 'playing' ||
    !state ||
    !clock ||
    room.transition ||
    clock.pausedAt !== null ||
    !humanConnected(room) ||
    seat === undefined
  ) {
    room.botWake = null;
    return null;
  }

  // Human commitments do not restart the bots' wait within the same sealed decision.
  const preparation = state.phase.type === 'PREPARATION';
  const key = preparation ? clock.decisionId : `${clock.decisionId}:${state.revision}:${seat}`;
  if (room.botWake?.key !== key) {
    const now = ports.now();
    const delay =
      preparation && clock.deadline !== null
        ? Math.max(0, Math.min(THINK_MS, Math.floor((clock.deadline - now) / 2)))
        : THINK_MS;
    room.botWake = { key, at: now + delay };
  }

  return room.botWake.at;
}

export function advanceBot(room: RoomRuntime, ports: Ports): boolean {
  const at = botWakeAt(room, ports);
  const { clock } = room;
  const state = room.state.match;
  if (at === null || ports.now() < at || !state || !clock) return false;

  // Preparation bots think concurrently and commit in seat order from the same sealed state.
  for (const seat of clock.dependencies) {
    if (!room.state.seats[seat]?.bot) continue;
    const view = projectPlayerView(state, seat);
    const action = chooseAction(view, 'training', ports.randomInt(1000) / 1000);

    applyGameplay(
      room,
      seat,
      {
        commandId: ports.id(),
        matchId: room.state.matchId,
        decisionId: clock.decisionId,
        expectedRevision: state.revision,
        action,
      },
      ports,
    );
    if (state.phase.type !== 'PREPARATION') break;
  }
  room.botWake = null;

  return true;
}
