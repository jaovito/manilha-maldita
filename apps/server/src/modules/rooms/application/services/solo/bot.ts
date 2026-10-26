import { projectPlayerView } from '@truco/game-core/projections';
import { chooseAction } from '@truco/game-sim';
import type { Ports } from '../../ports/runtime';
import type { RoomRuntime } from '../../state/room-runtime';
import { applyGameplay } from '../../use-cases/match/execute-gameplay';
import { humanConnected } from '../membership/presence';

/** Only projected information crosses the policy boundary. Timers share the room queue. */
export function botWakeAt(room: RoomRuntime, ports: Ports): number | null {
  const seat = room.clock?.dependencies.find((index) => room.state.seats[index]?.bot);
  if (
    !room.state.solo ||
    room.state.status !== 'playing' ||
    !room.state.match ||
    room.transition ||
    room.clock?.pausedAt != null ||
    !humanConnected(room) ||
    seat === undefined
  ) {
    room.botWake = null;
    return null;
  }

  const key = `${room.state.matchId}:${room.clock?.decisionId}:${room.state.match.revision}:${seat}`;
  if (room.botWake?.key !== key) room.botWake = { key, at: ports.now() + 1000 };

  return room.botWake.at;
}

export function advanceBot(room: RoomRuntime, ports: Ports): boolean {
  const at = botWakeAt(room, ports);
  if (at === null || ports.now() < at || !room.state.match) return false;

  const seat = room.clock?.dependencies.find((index) => room.state.seats[index]?.bot);
  if (seat === undefined) return false;

  const view = projectPlayerView(room.state.match, seat);
  const action = chooseAction(view, 'training', ports.randomInt(1000) / 1000);

  applyGameplay(
    room,
    seat,
    {
      commandId: ports.id(),
      matchId: room.state.matchId,
      decisionId: room.clock?.decisionId ?? null,
      expectedRevision: room.state.match.revision,
      action,
    },
    ports,
  );
  room.botWake = null;

  return true;
}
