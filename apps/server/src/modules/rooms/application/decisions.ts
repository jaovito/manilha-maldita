import { createClock, updateConnectivity } from '../../matches';
import { connected, type Ports, protectionMs, type Room } from './types';

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
  const team =
    phase.type === 'ELEVEN_DECISION'
      ? phase.team
      : state.hand.betting.lastRaisingTeam === 'A'
        ? 'B'
        : 'A';
  const dependencies =
    phase.type === 'PREPARATION'
      ? room.seats.flatMap((_, seat) => (state.powers?.commitments[seat] === null ? [seat] : []))
      : phase.type === 'TURN'
        ? [phase.seat]
        : room.seats.flatMap((_, seat) => ((seat % 2 === 0 ? 'A' : 'B') === team ? [seat] : []));

  room.clock = updateConnectivity(
    createClock(
      ports.id(),
      ports.now(),
      phase.type === 'PREPARATION'
        ? room.config.preparationTimeoutMs
        : phase.type === 'TURN'
          ? room.config.cardTimeoutMs
          : room.config.responseTimeoutMs,
      dependencies,
      protectionMs(room),
      room.budgets,
      phase.type === 'TURN' || phase.type === 'PREPARATION' ? 'all' : 'any',
    ),
    ports.now(),
    connected(room),
  );
}
