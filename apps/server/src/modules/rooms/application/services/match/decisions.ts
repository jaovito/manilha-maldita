import { createClock, updateConnectivity } from '../../../../matches';
import type { Ports } from '../../ports/runtime';
import type { RoomRuntime } from '../../state/room-runtime';
import { connected, protectionMs } from '../membership/presence';

export function openDecision(room: RoomRuntime, ports: Ports): void {
  const state = room.state.match;
  room.clock = null;

  if (state === null || room.state.status !== 'playing') return;
  if (state.phase.type === 'HAND_END') throw new Error('INVALID_PHASE');

  if (state.phase.type === 'MATCH_END') {
    room.state.status = 'finished';
    room.state.outcome = { winner: state.phase.winner, reason: 'completed' };
    return;
  }

  const phase = state.phase;
  let dependencies: number[];
  let durationMs: number | null;
  let policy: 'all' | 'any';

  switch (phase.type) {
    case 'PREPARATION':
      dependencies = room.state.seats.flatMap((_, seat) =>
        state.powers?.commitments[seat] === null ? [seat] : [],
      );
      durationMs = room.state.config.preparationTimeoutMs;
      policy = 'all';
      break;
    case 'TURN':
      dependencies = [phase.seat];
      durationMs = room.state.config.cardTimeoutMs;
      policy = 'all';
      break;
    default: {
      const team =
        phase.type === 'ELEVEN_DECISION'
          ? phase.team
          : state.hand.betting.lastRaisingTeam === 'A'
            ? 'B'
            : 'A';

      dependencies = room.state.seats.flatMap((_, seat) =>
        (seat % 2 === 0 ? 'A' : 'B') === team ? [seat] : [],
      );
      durationMs = room.state.config.responseTimeoutMs;
      policy = 'any';
    }
  }

  room.clock = updateConnectivity(
    createClock(
      ports.id(),
      ports.now(),
      durationMs,
      dependencies,
      protectionMs(room),
      room.budgets,
      policy,
    ),
    ports.now(),
    connected(room),
  );
}
