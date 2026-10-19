import { createClock, updateConnectivity } from '../../../matches';
import type { Ports, Room } from '../state/types';
import { connected, protectionMs } from '../state/presence';

export function openDecision(room: Room, ports: Ports): void {
  const state = room.match;
  room.clock = null;

  if (state === null || room.status !== 'playing') return;
  if (state.phase.type === 'HAND_END') throw new Error('INVALID_PHASE');

  if (state.phase.type === 'MATCH_END') {
    room.status = 'finished';
    room.outcome = { winner: state.phase.winner, reason: 'completed' };
    return;
  }

  const phase = state.phase;
  let dependencies: number[];
  let durationMs: number | null;
  let policy: 'all' | 'any';

  switch (phase.type) {
    case 'PREPARATION':
      dependencies = room.seats.flatMap((_, seat) =>
        state.powers?.commitments[seat] === null ? [seat] : [],
      );
      durationMs = room.config.preparationTimeoutMs;
      policy = 'all';
      break;
    case 'TURN':
      dependencies = [phase.seat];
      durationMs = room.config.cardTimeoutMs;
      policy = 'all';
      break;
    default: {
      const team =
        phase.type === 'ELEVEN_DECISION'
          ? phase.team
          : state.hand.betting.lastRaisingTeam === 'A'
            ? 'B'
            : 'A';

      dependencies = room.seats.flatMap((_, seat) =>
        (seat % 2 === 0 ? 'A' : 'B') === team ? [seat] : [],
      );
      durationMs = room.config.responseTimeoutMs;
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
