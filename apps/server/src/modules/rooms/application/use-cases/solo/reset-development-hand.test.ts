import { expect, test } from 'bun:test';
import { cardKey } from '@truco/game-core/cards';
import { startMatch } from '@truco/game-core/match';
import { type ClientMessage, defaultRoomConfig } from '@truco/game-protocol';
import { fixture } from '../../room-application.test';
import type { RoomRuntime } from '../../state/room-runtime';
import { resetDevelopmentHand } from './reset-development-hand';

function scenario() {
  const { ports } = fixture();
  const state = startMatch(2, 0, Array(39).fill(0), {
    preset: 'casual',
    draws: [0, 1],
    flips: [0, 0],
    spies: [0, 0],
  }).state;
  const room: RoomRuntime = {
    state: {
      code: 'ABC123',
      solo: true,
      devTools: true,
      revision: 0,
      config: defaultRoomConfig,
      hostSeat: 0,
      seats: [],
      status: 'playing',
      match: state,
      matchId: 'match',
      outcome: null,
    },
    sequence: 0,
    connections: new Map(),
    clock: null,
    transition: null,
    budgets: [],
    emptySince: null,
    cache: new Map(),
    chain: Promise.resolve(),
    pending: 0,
    cancel: null,
  };
  const message: ClientMessage = {
    protocol: 1,
    commandId: 'reset',
    matchId: 'match',
    decisionId: null,
    expectedRevision: state.revision,
    action: { type: 'DEV_RESET_HAND' },
  };
  return { room, message, ports };
}

test('customizing all four powers preserves 40 unique cards and score while clearing previous hand context', () => {
  for (const power of ['spy', 'exchange', 'boost', 'mask'] as const) {
    const { room, message, ports } = scenario();
    if (!room.state.match) throw new Error('Missing state');
    const cards = [
      room.state.match.hand.vira,
      room.state.match.hand.hands[1]?.[0],
      room.state.match.hand.stock[0],
    ];
    if (!cards[0] || !cards[1] || !cards[2]) throw new Error('Missing cards');
    const requested = [cards[0], cards[1], cards[2]];
    room.state.match = { ...room.state.match, score: { A: 5, B: 6 } };
    resetDevelopmentHand(
      room,
      0,
      {
        ...message,
        action: { type: 'DEV_RESET_HAND', cards: requested, power, energy: 0 },
      },
      ports,
    );
    const state = room.state.match;
    const all = [...state.hand.hands.flat(), ...state.hand.stock, state.hand.vira];
    expect(all).toHaveLength(40);
    expect(new Set(all.map(cardKey)).size).toBe(40);
    expect(state.hand.hands[0]).toEqual(requested);
    expect(state.score).toEqual({ A: 5, B: 6 });
    expect(state.hand.plays).toEqual([]);
    expect(state.hand.completedTricks).toEqual([]);
    expect(state.powers?.slots[0]).toBe(power);
    expect(state.powers?.energy[0]).toBe(0);
    expect(state.powers?.used).toEqual([false, false]);
    expect(state.powers?.intel).toEqual([null, null]);
    expect(state.powers?.commitments).toEqual([null, null]);
    expect(room.transition?.kind).toBe('deal');
  }
});

test('unauthorized, stale and special-hand power edits fail before consuming entropy or mutating state', () => {
  const { room, message, ports } = scenario();
  let samples = 0;
  const counted = {
    ...ports,
    randomInt: (max: number) => {
      samples++;
      return ports.randomInt(max);
    },
  };
  const before = room.state.match;
  for (const [seat, request, error] of [
    [1, message, 'DEV_TOOLS_DISABLED'],
    [0, { ...message, matchId: 'other' }, 'STALE_CONTEXT'],
    [0, { ...message, decisionId: 'old' }, 'STALE_CONTEXT'],
    [0, { ...message, expectedRevision: 50 }, 'STALE_REVISION'],
  ] as const)
    expect(() => resetDevelopmentHand(room, seat, request, counted)).toThrow(error);
  expect(room.state.match).toBe(before);
  expect(samples).toBe(0);
  if (!before) throw new Error('Missing state');
  room.state.match = { ...before, score: { A: 11, B: 0 } };
  expect(() =>
    resetDevelopmentHand(
      room,
      0,
      { ...message, action: { type: 'DEV_RESET_HAND', power: 'spy' } },
      counted,
    ),
  ).toThrow('POWER_UNAVAILABLE');
  expect(samples).toBe(0);
  resetDevelopmentHand(room, 0, message, counted);
  expect(room.state.match?.hand.kind).toBe('eleven');
  expect(room.state.match?.powers?.slots).toEqual([null, null]);
  room.state.status = 'finished';
  expect(() => resetDevelopmentHand(room, 0, message, counted)).toThrow('INVALID_PHASE');
});
