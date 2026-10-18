import { cardKey, cardStrength } from '@truco/game-core/cards';
import {
  dealNextHand,
  executeCommand,
  type PlayerCommand,
  startMatch,
} from '@truco/game-core/match';
import type { Action, ClientMessage } from '@truco/game-protocol';
import { createClock, expirations, updateConnectivity } from '../../matches';
import { choices, connected, type Ports, powerSetup, protectionMs, type Room } from './types';

export function openDecision(room: Room, ports: Ports): void {
  const state = room.match;
  room.clock = null;

  if (state === null || room.status !== 'playing') return;

  if (state.phase.type === 'MATCH_END') {
    room.status = 'finished';
    room.outcome = { winner: state.phase.winner, reason: 'completed' };
    return;
  }

  if (state.phase.type === 'HAND_END') {
    room.match = dealNextHand(
      state,
      state.revision,
      choices(ports),
      state.score.A === 11 || state.score.B === 11 ? undefined : powerSetup(room, ports),
    ).state;
    openDecision(room, ports);
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

export function beginMatch(room: Room, ports: Ports): void {
  const count = room.config.format === '1v1' ? 2 : 4;

  room.match = startMatch(
    count,
    ports.randomInt(count),
    choices(ports),
    powerSetup(room, ports),
  ).state;
  room.matchId = ports.id();
  room.status = 'playing';
  room.outcome = null;
  room.budgets = room.seats.map(() => protectionMs(room));

  for (const member of room.seats) if (member) member.strikes = 0;

  openDecision(room, ports);
}

export function closeAbnormally(
  room: Room,
  winner: 'A' | 'B' | null,
  reason: 'surrender' | 'abandonment' | 'expired' | 'technical',
): void {
  room.status = 'finished';
  room.outcome = { winner, reason };
  room.clock = null;
}

export function advanceClock(room: Room, ports: Ports): boolean {
  if (room.clock === null || room.match === null || room.status !== 'playing') return false;

  const { state: clock, expired } = expirations(room.clock, ports.now(), connected(room));
  room.clock = clock;
  room.budgets = clock.budgets;

  if (!expired) return false;
  const state = room.match;

  for (const seat of clock.dependencies) {
    const member = room.seats[seat];
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
    room.match = next;
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

  room.match = executeCommand(state, state.revision, seat, action).state;
  openDecision(room, ports);

  return true;
}

export function applyGameplay(
  room: Room,
  seat: number,
  message: ClientMessage,
  ports: Ports,
): void {
  const state = room.match;

  if (room.status !== 'playing' || state === null) throw new Error('INVALID_PHASE');
  if (message.matchId !== room.matchId || message.decisionId !== room.clock?.decisionId)
    throw new Error('STALE_CONTEXT');
  if (message.action.type !== 'PREPARE' && message.expectedRevision !== state.revision)
    throw new Error('STALE_REVISION');

  if (message.action.type === 'SURRENDER') {
    closeAbnormally(room, seat % 2 === 0 ? 'B' : 'A', 'surrender');
    return;
  }

  if (
    message.action.type !== 'PREPARE' &&
    room.clock?.pausedAt !== null &&
    room.clock?.pausedAt !== undefined
  )
    throw new Error('DECISION_PAUSED');

  const action: Action = message.action;
  if (
    !['PREPARE', 'PLAY_CARD', 'REQUEST_RAISE', 'RESPOND_RAISE', 'DECIDE_ELEVEN'].includes(
      action.type,
    )
  )
    throw new Error('INVALID_COMMAND');

  // The discriminated cases below prevent lobby/transport actions entering the core.
  switch (action.type) {
    case 'PREPARE':
    case 'PLAY_CARD':
    case 'REQUEST_RAISE':
    case 'RESPOND_RAISE':
    case 'DECIDE_ELEVEN':
      room.match = executeCommand(state, state.revision, seat, action).state;
      break;
  }

  const member = room.seats[seat];
  if (member) member.strikes = 0;

  if (
    state.phase.type === 'PREPARATION' &&
    room.match?.phase.type === 'PREPARATION' &&
    room.clock
  ) {
    room.clock = updateConnectivity(
      {
        ...room.clock,
        dependencies: room.seats.flatMap((_, owner) =>
          room.match?.powers?.commitments[owner] === null ? [owner] : [],
        ),
      },
      ports.now(),
      connected(room),
    );
    room.budgets = room.clock.budgets;
  } else openDecision(room, ports);
}
