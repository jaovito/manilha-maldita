import { cardKey, cardStrength } from '@truco/game-core/cards';
import { executeCommand, type PlayerCommand, startMatch } from '@truco/game-core/match';
import { expirations } from '../../../../matches';
import type { Ports } from '../../ports/runtime';
import { connected, protectionMs } from '../membership/presence';
import { choices, powerSetup } from './randomness';
import type { RoomRuntime } from '../../state/room-runtime';
import { openDecision } from './decisions';
import { advanceTransition, openTransition, settleGameplay } from './transitions';

export function beginMatch(room: RoomRuntime, ports: Ports): void {
  const count = room.state.config.format === '1v1' ? 2 : 4;

  room.state.match = startMatch(
    count,
    ports.randomInt(count),
    choices(ports),
    powerSetup(room, ports),
  ).state;
  room.state.matchId = ports.id();
  room.state.status = 'playing';
  room.state.outcome = null;
  room.budgets = room.state.seats.map(() => protectionMs(room));

  for (const member of room.state.seats) {
    if (member) member.strikes = 0;
  }

  openTransition(room, ports, 'deal');
}

export function closeAbnormally(
  room: RoomRuntime,
  winner: 'A' | 'B' | null,
  reason: 'surrender' | 'abandonment' | 'expired' | 'technical',
): void {
  room.state.status = 'finished';
  room.state.outcome = { winner, reason };
  room.clock = null;
  room.transition = null;
}

export function advanceClock(room: RoomRuntime, ports: Ports): boolean {
  if (room.transition !== null) return advanceTransition(room, ports);

  if (room.clock === null || room.state.match === null || room.state.status !== 'playing')
    return false;

  const { state: clock, expired } = expirations(room.clock, ports.now(), connected(room));
  room.clock = clock;
  room.budgets = clock.budgets;

  if (!expired) return false;

  const state = room.state.match;

  for (const seat of clock.dependencies) {
    const member = room.state.seats[seat];
    if (member) {
      member.strikes++;
      if (member.strikes >= 3) {
        closeAbnormally(room, seat % 2 === 0 ? 'B' : 'A', 'abandonment');
        return true;
      }
    }
  }

  if (state.phase.type === 'PREPARATION') {
    let next = state;

    for (const pending of clock.dependencies)
      next = executeCommand(next, next.revision, pending, {
        type: 'PREPARE',
        intent: { type: 'pass' },
      }).state;

    room.state.match = next;
    openDecision(room, ports);

    return true;
  }

  let action: PlayerCommand;
  const seat = clock.dependencies[0];
  if (seat === undefined) throw new Error('INVALID_PHASE');

  if (state.phase.type === 'TURN') {
    const card = [...(state.hand.hands[seat] ?? [])].sort(
      (left, right) =>
        cardStrength(left, state.hand.vira) - cardStrength(right, state.hand.vira) ||
        (cardKey(left) < cardKey(right) ? -1 : cardKey(left) > cardKey(right) ? 1 : 0),
    )[0];
    if (card === undefined) throw new Error('INVALID_PHASE');

    action = { type: 'PLAY_CARD', card, covered: false };
  } else if (state.phase.type === 'RAISE_RESPONSE') {
    action = { type: 'RESPOND_RAISE', response: 'fold' };
  } else {
    action = { type: 'DECIDE_ELEVEN', response: 'fold' };
  }

  room.state.match = executeCommand(state, state.revision, seat, action).state;
  settleGameplay(room, state, ports);

  return true;
}
