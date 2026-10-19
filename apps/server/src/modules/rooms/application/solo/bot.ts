import { projectPlayerView } from '@truco/game-core/projections';
import { chooseAction } from '@truco/game-sim';
import { applyGameplay } from '../match/gameplay';
import type { Ports, Room } from '../state/types';
import { humanConnected } from '../state/presence';

/** Only projected information crosses the policy boundary. Timers share the room queue. */
export function botWakeAt(room: Room, ports: Ports): number | null {
  const seat = room.clock?.dependencies.find((index) => room.seats[index]?.bot);
  if (
    !room.solo ||
    room.status !== 'playing' ||
    !room.match ||
    room.transition ||
    room.clock?.pausedAt != null ||
    !humanConnected(room) ||
    seat === undefined
  ) {
    room.botWake = null;
    return null;
  }

  const key = `${room.matchId}:${room.clock?.decisionId}:${room.match.revision}:${seat}`;
  if (room.botWake?.key !== key) room.botWake = { key, at: ports.now() + 1000 };

  return room.botWake.at;
}

export function advanceBot(room: Room, ports: Ports): boolean {
  const at = botWakeAt(room, ports);
  if (at === null || ports.now() < at || !room.match) return false;

  const seat = room.clock?.dependencies.find((index) => room.seats[index]?.bot);
  if (seat === undefined) return false;

  const view = projectPlayerView(room.match, seat);
  const action = chooseAction(view, 'conservative', ports.randomInt(1000) / 1000);

  applyGameplay(
    room,
    seat,
    {
      protocol: 1,
      commandId: ports.id(),
      matchId: room.matchId,
      decisionId: room.clock?.decisionId ?? null,
      expectedRevision: room.match.revision,
      action,
    },
    ports,
  );
  room.botWake = null;

  return true;
}
