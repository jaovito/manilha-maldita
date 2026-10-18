import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { type Card, cardKey, createDeck } from '../cards/cards';
import { dealNextHand, executeCommand, startMatch } from './match';
import type { MatchState, PlayerCommand, Transition } from './types';

const identity = Array.from({ length: 39 }, (_, index) => 39 - index);

function command(state: MatchState, seat: number, input: PlayerCommand): Transition {
  const before = structuredClone(state);
  const result = executeCommand(state, state.revision, seat, input);
  expect(state).toEqual(before);
  expect(result.state.revision).toBe(state.revision + 1);
  return result;
}

function play(state: MatchState, covered = false): MatchState {
  if (state.phase.type !== 'TURN') throw new Error('TEST_EXPECTED_TURN');
  const card = state.hand.hands[state.phase.seat]?.[0];
  if (card === undefined) throw new Error('TEST_EXPECTED_CARD');
  return command(state, state.phase.seat, { type: 'PLAY_CARD', card, covered }).state;
}

function finishCards(input: MatchState): MatchState {
  let state = input;
  for (let steps = 0; state.phase.type === 'TURN' && steps < 12; steps++) state = play(state);
  expect(['HAND_END', 'MATCH_END']).toContain(state.phase.type);
  return state;
}

function assertConservation(state: MatchState): void {
  const { hand } = state;
  const cards = [
    ...hand.hands.flat(),
    hand.vira,
    ...hand.stock,
    ...hand.plays.map((entry) => entry.card),
    ...hand.completedTricks.flatMap((trick) => trick.plays.map((entry) => entry.card)),
  ];
  expect(cards).toHaveLength(40);
  expect(new Set(cards.map(cardKey)).size).toBe(40);
}

// Trusted shuffle choices produce a real deal with A's cards strictly stronger than B's.
function winningChoices(count: 2 | 4, leader: number): number[] {
  const deck = createDeck();
  const strong = deck.filter((card) => ['2', '3'].includes(card.rank));
  const weak = deck.filter((card) => ['4', '5'].includes(card.rank));
  const dealt: Card[] = [];
  for (let offset = 0; offset < count * 3; offset++) {
    const seat = (leader + offset) % count;
    const card = seat % 2 === 0 ? strong.shift() : weak.shift();
    if (card === undefined) throw new Error('TEST_INVALID_DECK');
    dealt.push(card);
  }
  const vira: Card = { rank: 'Q', suit: 'clubs' };
  const used = new Set([...dealt, vira].map(cardKey));
  const target = [...dealt, vira, ...deck.filter((card) => !used.has(cardKey(card)))];
  const working = createDeck();
  const choices: number[] = [];
  for (let index = 39; index > 0; index--) {
    const expected = target[index];
    if (expected === undefined) throw new Error('TEST_INVALID_DECK');
    const chosen = working.findIndex((card) => cardKey(card) === cardKey(expected));
    const current = working[index];
    const selected = working[chosen];
    if (chosen > index || current === undefined || selected === undefined) {
      throw new Error('TEST_INVALID_SHUFFLE');
    }
    choices.push(chosen);
    working[index] = selected;
    working[chosen] = current;
  }
  return choices;
}

for (const count of [2, 4] as const) {
  test(`complete ${count}-seat match rotates the leader, scores once and ends at twelve`, () => {
    let state = startMatch(count, 0, winningChoices(count, 0)).state;
    expect(state.revision).toBe(0);
    expect(state.score).toEqual({ A: 0, B: 0 });
    for (let number = 1; number <= 12; number++) {
      expect(state.hand.number).toBe(number);
      expect(state.hand.leader).toBe((number - 1) % count);
      assertConservation(state);
      if (number === 12) {
        expect(state.phase).toEqual({ type: 'ELEVEN_DECISION', team: 'A' });
        state = command(state, 0, { type: 'DECIDE_ELEVEN', response: 'play' }).state;
        expect(state.hand.betting.acceptedStake).toBe(3);
      }
      state = finishCards(state);
      assertConservation(state);
      expect(state.score).toEqual({ A: Math.min(number === 12 ? 14 : number, 12), B: 0 });
      expect(state.hand.completedTricks).toHaveLength(2);
      if (number < 12) {
        expect(state.phase.type).toBe('HAND_END');
        const nextLeader = number % count;
        state = dealNextHand(state, state.revision, winningChoices(count, nextLeader)).state;
      }
    }
    expect(state.phase).toEqual({ type: 'MATCH_END', winner: 'A' });
    const before = structuredClone(state);
    expect(() => dealNextHand(state, state.revision, identity)).toThrow();
    expect(() => executeCommand(state, state.revision, 0, { type: 'REQUEST_RAISE' })).toThrow();
    expect(state).toEqual(before);
  });
}

test('counter-raise folds reward the accepted amount and preserve original reward at score cap', () => {
  let state = startMatch(2, 0, identity).state;
  state = command(state, 0, { type: 'REQUEST_RAISE' }).state;
  state = command(state, 1, { type: 'RESPOND_RAISE', response: 'raise' }).state;
  const folded = command(state, 0, { type: 'RESPOND_RAISE', response: 'fold' });
  expect(folded.state.score).toEqual({ A: 0, B: 3 });
  expect(folded.events).toContainEqual({
    type: 'HAND_ENDED',
    winner: 'B',
    reward: 3,
    score: { A: 0, B: 3 },
  });
  const nearEnd: MatchState = { ...state, score: { A: 0, B: 10 } };
  const capped = command(nearEnd, 0, { type: 'RESPOND_RAISE', response: 'fold' });
  expect(capped.state.score.B).toBe(12);
  expect(capped.events).toContainEqual({
    type: 'HAND_ENDED',
    winner: 'B',
    reward: 3,
    score: { A: 0, B: 12 },
  });
  expect(capped.events).toContainEqual({ type: 'MATCH_ENDED', winner: 'B' });
});

test('pending raises block plays; teammate response resumes the saved turn and closes the decision', () => {
  let state = startMatch(4, 2, identity).state;
  state = command(state, 2, { type: 'REQUEST_RAISE' }).state;
  const before = structuredClone(state);
  const card = state.hand.hands[2]?.[0];
  if (card === undefined) throw new Error('TEST_EXPECTED_CARD');
  expect(() =>
    executeCommand(state, state.revision, 2, { type: 'PLAY_CARD', card, covered: false }),
  ).toThrow();
  expect(() =>
    executeCommand(state, state.revision, 0, { type: 'RESPOND_RAISE', response: 'accept' }),
  ).toThrow();
  expect(state).toEqual(before);
  const accepted = command(state, 3, { type: 'RESPOND_RAISE', response: 'accept' }).state;
  expect(accepted.phase).toEqual({ type: 'TURN', seat: 2 });
  expect(accepted.hand.betting.acceptedStake).toBe(3);
  expect(() =>
    executeCommand(accepted, state.revision, 1, { type: 'RESPOND_RAISE', response: 'fold' }),
  ).toThrow('STALE_REVISION');
  expect(() =>
    executeCommand(accepted, accepted.revision, 1, { type: 'RESPOND_RAISE', response: 'fold' }),
  ).toThrow();
  expect(() => executeCommand(accepted, accepted.revision, 2, { type: 'REQUEST_RAISE' })).toThrow();
});

test('illegal possession, covered first play, wrong turn and replay never mutate state', () => {
  const state = startMatch(2, 0, identity).state;
  const own = state.hand.hands[0]?.[0];
  const opponent = state.hand.hands[1]?.[0];
  if (own === undefined || opponent === undefined) throw new Error('TEST_EXPECTED_CARD');
  const before = structuredClone(state);
  for (const [seat, card, covered] of [
    [1, opponent, false],
    [0, opponent, false],
    [0, state.hand.vira, false],
    [0, own, true],
  ] as const) {
    expect(() =>
      executeCommand(state, state.revision, seat, { type: 'PLAY_CARD', card, covered }),
    ).toThrow();
    expect(state).toEqual(before);
  }
  expect(() => dealNextHand(state, state.revision, identity)).toThrow();
  const next = play(state);
  expect(() =>
    executeCommand(next, state.revision, 0, { type: 'PLAY_CARD', card: own, covered: false }),
  ).toThrow('STALE_REVISION');
  expect(next.revision).toBe(1);
});

test('eleven folds reach 11×11 naturally; decisive ties redeal and rotate without scoring', () => {
  let state = startMatch(2, 0, identity).state;
  for (let points = 0; points < 11; points++) {
    if (state.phase.type !== 'TURN') throw new Error('TEST_EXPECTED_TURN');
    if (state.phase.seat !== 0) state = play(state);
    state = command(state, 0, { type: 'REQUEST_RAISE' }).state;
    state = command(state, 1, { type: 'RESPOND_RAISE', response: 'fold' }).state;
    state = dealNextHand(state, state.revision, identity).state;
  }
  expect(state.score).toEqual({ A: 11, B: 0 });
  for (let points = 0; points < 11; points++) {
    expect(state.phase).toEqual({ type: 'ELEVEN_DECISION', team: 'A' });
    const before = structuredClone(state);
    expect(() =>
      executeCommand(state, state.revision, 1, { type: 'DECIDE_ELEVEN', response: 'play' }),
    ).toThrow();
    expect(() => executeCommand(state, state.revision, 0, { type: 'REQUEST_RAISE' })).toThrow();
    expect(state).toEqual(before);
    state = command(state, 0, { type: 'DECIDE_ELEVEN', response: 'fold' }).state;
    expect(state.score).toEqual({ A: 11, B: points + 1 });
    state = dealNextHand(state, state.revision, identity).state;
  }
  expect(state.hand.kind).toBe('decisive');
  expect(state.hand.betting.acceptedStake).toBe(3);
  expect(state.phase.type).toBe('TURN');
  expect(() =>
    executeCommand(state, state.revision, 0, { type: 'DECIDE_ELEVEN', response: 'fold' }),
  ).toThrow();
  if (state.phase.type !== 'TURN') throw new Error('TEST_EXPECTED_TURN');
  expect(() =>
    executeCommand(state, state.revision, state.phase.type === 'TURN' ? state.phase.seat : 0, {
      type: 'REQUEST_RAISE',
    }),
  ).toThrow();
  state = play(play(state));
  expect(state.hand.completedTricks).toHaveLength(1);
  expect(() => play(state, true)).toThrow();
  state = finishCards(state);
  expect(state.phase).toEqual({ type: 'HAND_END', winner: 'tie', reward: 0 });
  expect(state.score).toEqual({ A: 11, B: 11 });
  const previousLeader = state.hand.leader;
  state = dealNextHand(state, state.revision, winningChoices(2, (previousLeader + 1) % 2)).state;
  expect(state.hand.leader).toBe((previousLeader + 1) % 2);
  expect(state.hand.kind).toBe('decisive');
  state = finishCards(state);
  expect(state.phase).toEqual({ type: 'MATCH_END', winner: 'A' });
  expect(state.score).toEqual({ A: 12, B: 11 });
});

test('generated deals conserve forty cards and reject every out-of-turn play', () => {
  const choices = fc.tuple(
    ...Array.from({ length: 39 }, (_, index) => fc.integer({ min: 0, max: 39 - index })),
  );
  fc.assert(
    fc.property(choices, fc.constantFrom<2 | 4>(2, 4), (entropy, count) => {
      let state = startMatch(count, count - 1, entropy).state;
      assertConservation(state);
      for (let step = 0; state.phase.type === 'TURN' && step < 12; step++) {
        const wrongSeat = (state.phase.seat + 1) % count;
        const card =
          state.hand.hands[wrongSeat]?.[0] ??
          state.hand.plays.find((entry) => entry.seat === wrongSeat)?.card;
        if (card === undefined) throw new Error('TEST_EXPECTED_CARD');
        const before = structuredClone(state);
        expect(() =>
          executeCommand(state, state.revision, wrongSeat, {
            type: 'PLAY_CARD',
            card,
            covered: false,
          }),
        ).toThrow();
        expect(state).toEqual(before);
        state = play(state);
        assertConservation(state);
      }
      expect(state.phase.type).toBe('HAND_END');
      expect(state.score.A + state.score.B).toBeLessThanOrEqual(1);
    }),
    { seed: 20261018, numRuns: 100 },
  );
});
