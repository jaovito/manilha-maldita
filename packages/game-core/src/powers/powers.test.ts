import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { cardKey, createDeck } from '../cards/cards';
import { finishHand } from '../match/lifecycle';
import { dealNextHand, startMatch } from '../match/match';
import { projectPlayerView, projectPublicView } from '../projections/project-views';
import { initializePowers, POWER_IDS, type PreparationIntent } from './powers';

import { act, begin, card, commit, setup, shuffle } from '../../tests/powers-fixture';

test('draws, symmetric assignments, initial energy, regeneration, cap and special hands', () => {
  for (const first of [0, 1, 2, 3]) {
    expect(startMatch(2, 0, shuffle, setup([first, 0], 'competitive')).state.powers?.slots).toEqual(
      [POWER_IDS[first] ?? 'spy', POWER_IDS[first] ?? 'spy'],
    );
    for (const second of [0, 1, 2]) {
      const state = startMatch(4, 0, shuffle, setup([first, second, 0, 0], 'competitive')).state;
      expect(state.powers?.slots[0]).toBe(state.powers?.slots[3]);
      expect(state.powers?.slots[1]).toBe(state.powers?.slots[2]);
      expect(state.powers?.slots[0]).not.toBe(state.powers?.slots[2]);
    }
  }
  let state = begin();
  expect(state.powers?.energy).toEqual([2, 2, 2, 2]);
  expect(state.powers?.slots).toEqual(['spy', 'exchange', 'spy', 'exchange']);
  state = dealNextHand(finishHand(state, 'A', 1).state, state.revision + 1, shuffle, setup()).state;
  expect(state.powers?.energy).toEqual([3, 3, 3, 3]);
  const special = { ...state, score: { A: 11, B: 0 } };
  const eleven = dealNextHand(
    finishHand(special, 'tie', 0).state,
    special.revision + 1,
    shuffle,
  ).state;
  expect(eleven.phase.type).toBe('ELEVEN_DECISION');
  expect(eleven.powers?.energy).toEqual([3, 3, 3, 3]);
  expect(eleven.powers?.slots).toEqual([null, null, null, null]);
  const decisive = dealNextHand(
    finishHand({ ...eleven, score: { A: 11, B: 11 } }, 'tie', 0).state,
    eleven.revision + 1,
    shuffle,
  ).state;
  expect(decisive.phase.type).toBe('TURN');
  expect(decisive.powers?.energy).toEqual(eleven.powers?.energy);
  expect(() =>
    act(decisive, decisive.hand.leader, {
      type: 'PLAY_CARD',
      card: card(decisive, decisive.hand.leader),
      covered: false,
      power: 'mask',
    }),
  ).toThrow('POWER_UNAVAILABLE');
  const { powers: omitted, ...base } = decisive;
  expect(omitted).toBeDefined();
  expect(initializePowers(base).powers).toBeUndefined();
});

test('sealed commitments reveal no expenses, targets or choices; batch ignores arrival order and spies follow swaps', () => {
  const initial = begin();
  const intents: readonly PreparationIntent[] = [
    { type: 'spy', target: 1 },
    { type: 'exchange', card: card(initial, 1, 0) },
    { type: 'spy', target: 3 },
    { type: 'exchange', card: card(initial, 3, 0) },
  ];
  const once = commit(initial, 0, intents[0] ?? { type: 'pass' });
  const passed = commit(initial, 0, { type: 'pass' });
  expect(projectPublicView(once)).toEqual(projectPublicView(passed));
  expect(projectPlayerView(once, 1)).toEqual(projectPlayerView(passed, 1));
  expect(projectPublicView(once).powers?.activations).toEqual([]);
  expect(() => commit(once, 0, { type: 'pass' })).toThrow('ALREADY_PREPARED');
  const resolve = (order: number[]) =>
    order.reduce((state, seat) => commit(state, seat, intents[seat] ?? { type: 'pass' }), initial);
  const result = resolve([0, 1, 2, 3]);
  expect(resolve([3, 2, 1, 0])).toEqual(result);
  expect(result.phase).toEqual({ type: 'TURN', seat: 0 });
  expect(result.powers?.energy).toEqual([1, 0, 1, 0]);
  expect(result.hand.hands[1]?.[2]).toEqual(initial.hand.stock[0]);
  expect(result.hand.hands[3]?.[2]).toEqual(initial.hand.stock[1]);
  expect(result.powers?.intel[0]?.card).toEqual(result.hand.hands[1]?.[2]);
  expect(projectPlayerView(result, 0).powers?.intel?.target).toBe(1);
  expect(projectPlayerView(result, 2).powers?.intel?.target).toBe(3);
  expect(projectPublicView(result).powers).not.toHaveProperty('intel');
  const physical = [
    ...result.hand.hands.flat(),
    result.hand.vira,
    ...result.hand.stock,
    ...(result.hand.discards ?? []),
  ];
  expect(physical.map(cardKey).sort()).toEqual(createDeck().map(cardKey).sort());
  expect(() => commit(result, 0, { type: 'pass' })).toThrow('INVALID_PHASE');
});

test('invalid preparations preserve state and validate ownership, enemy targets, energy and setup bounds', () => {
  const state = begin();
  const original = structuredClone(state);
  expect(() => commit(state, 0, { type: 'spy', target: 2 })).toThrow('INVALID_POWER_TARGET');
  expect(() => commit(state, 0, { type: 'spy', target: 4 })).toThrow('INVALID_SEAT');
  expect(() => commit(state, 0, { type: 'exchange', card: card(state, 0) })).toThrow(
    'POWER_UNAVAILABLE',
  );
  expect(() => commit(state, 1, { type: 'exchange', card: state.hand.vira })).toThrow(
    'CARD_NOT_OWNED',
  );
  if (!state.powers) throw new Error('NO_POWERS');
  const depleted = { ...state, powers: { ...state.powers, energy: [0, 0, 0, 0] } };
  expect(() => commit(depleted, 0, { type: 'spy', target: 1 })).toThrow('INSUFFICIENT_ENERGY');
  expect(state).toEqual(original);
  for (const invalid of [
    { ...setup(), draws: [-1] },
    { ...setup(), flips: [2, 0] },
    { ...setup(), spies: [3, 0, 0, 0] },
    setup([0, 3, 0, 0], 'competitive'),
  ]) {
    expect(() => startMatch(4, 0, shuffle, invalid)).toThrow('INVALID_POWER_SETUP');
  }
  expect(() => initializePowers(state)).toThrow('INVALID_POWER_SETUP');
});

test('generated preparation batches conserve cards and energy and are order independent', () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 4, maxLength: 4 }),
      fc.integer({ min: 0, max: 3 }),
      (draws, leader) => {
        const initial = begin(draws, leader);
        const run = (order: number[]) =>
          order.reduce(
            (state, seat) =>
              commit(
                state,
                seat,
                draws[seat] === 0
                  ? { type: 'spy', target: (seat + 1) % 4 }
                  : draws[seat] === 1
                    ? { type: 'exchange', card: card(initial, seat) }
                    : { type: 'pass' },
              ),
            initial,
          );
        const result = run([0, 1, 2, 3]);
        expect(result).toEqual(run([3, 1, 0, 2]));
        expect(result.powers?.energy.every((value) => value >= 0 && value <= 3)).toBe(true);
        expect(
          new Set(
            [
              ...result.hand.hands.flat(),
              ...result.hand.stock,
              result.hand.vira,
              ...(result.hand.discards ?? []),
            ].map(cardKey),
          ).size,
        ).toBe(40);
        for (const seat of [0, 1, 2, 3])
          expect(
            projectPlayerView(result, seat).hand.hands.filter(
              (hand) => hand.visibility === 'visible',
            ),
          ).toHaveLength(1);
      },
    ),
    { seed: 31207, numRuns: 80 },
  );
});

test('spent power expires, regeneration does not reroll unaffordable power, and special hands freeze low reserves', () => {
  let state = begin([1, 1]);
  state = commit(state, 0, { type: 'exchange', card: card(state, 0) });
  state = commit(state, 1, { type: 'exchange', card: card(state, 1) });
  expect(state.powers?.energy).toEqual([0, 0]);
  let ended = finishHand(state, 'A', 1).state;
  state = dealNextHand(ended, ended.revision, shuffle, setup([1, 1])).state;
  expect(state.powers?.energy).toEqual([1, 1]);
  expect(state.powers?.used).toEqual([false, false]);
  expect(state.powers?.slots).toEqual(['exchange', 'exchange']);
  expect(state.powers?.activations).toEqual([]);
  expect(state.hand.discards).toBeUndefined();
  expect(() => commit(state, 0, { type: 'exchange', card: card(state, 0) })).toThrow(
    'INSUFFICIENT_ENERGY',
  );
  ended = finishHand({ ...state, score: { A: 11, B: 0 } }, 'tie', 0).state;
  const special = dealNextHand(ended, ended.revision, shuffle).state;
  expect(special.powers?.energy).toEqual([1, 1]);
  expect(special.powers?.slots).toEqual([null, null]);
});
