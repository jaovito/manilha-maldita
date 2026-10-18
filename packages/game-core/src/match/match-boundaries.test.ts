import { expect, test } from 'bun:test';
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

test('six accepted and nine pending award six on fold; twelve cannot be counter-raised', () => {
  let state = startMatch(2, 0, identity).state;
  state = command(state, 0, { type: 'REQUEST_RAISE' }).state;
  state = command(state, 1, { type: 'RESPOND_RAISE', response: 'raise' }).state;
  state = command(state, 0, { type: 'RESPOND_RAISE', response: 'raise' }).state;
  expect(state.hand.betting.acceptedStake).toBe(6);
  expect(state.hand.betting.pendingStake).toBe(9);
  const folded = command(state, 1, { type: 'RESPOND_RAISE', response: 'fold' }).state;
  expect(folded.score).toEqual({ A: 6, B: 0 });
  state = command(state, 1, { type: 'RESPOND_RAISE', response: 'raise' }).state;
  expect(state.hand.betting.pendingStake).toBe(12);
  const before = structuredClone(state);
  expect(() =>
    executeCommand(state, state.revision, 0, { type: 'RESPOND_RAISE', response: 'raise' }),
  ).toThrow();
  expect(state).toEqual(before);
  state = command(state, 0, { type: 'RESPOND_RAISE', response: 'accept' }).state;
  expect(state.hand.betting.acceptedStake).toBe(12);
  expect(state.phase).toEqual({ type: 'TURN', seat: 0 });
});

test('either eleven teammate decides first, special hands block raises and allow later covered cards', () => {
  const ordinary = finishCards(startMatch(4, 0, identity).state);
  const scored: MatchState = { ...ordinary, score: { A: 11, B: 4 } };
  let state = dealNextHand(scored, scored.revision, identity).state;
  expect(state.phase).toEqual({ type: 'ELEVEN_DECISION', team: 'A' });
  const before = structuredClone(state);
  expect(() =>
    // @ts-expect-error invalid runtime response
    executeCommand(state, state.revision, 0, { type: 'DECIDE_ELEVEN', response: 'raise' }),
  ).toThrow();
  expect(state).toEqual(before);
  const previousRevision = state.revision;
  state = command(state, 2, { type: 'DECIDE_ELEVEN', response: 'play' }).state;
  expect(state.phase).toEqual({ type: 'TURN', seat: 1 });
  expect(() =>
    executeCommand(state, previousRevision, 0, { type: 'DECIDE_ELEVEN', response: 'fold' }),
  ).toThrow('STALE_REVISION');
  expect(() =>
    executeCommand(state, state.revision, 0, { type: 'DECIDE_ELEVEN', response: 'fold' }),
  ).toThrow();
  expect(() => executeCommand(state, state.revision, 1, { type: 'REQUEST_RAISE' })).toThrow();
  for (let offset = 0; offset < 4; offset++) state = play(state);
  expect(state.hand.completedTricks).toHaveLength(1);
  state = play(state, true);
  expect(state.hand.plays[0]?.covered).toBe(true);
});

test('invalid commands, seats, entropy and stale redeals are rejected through match API', () => {
  const state = startMatch(2, 0, identity).state;
  const before = structuredClone(state);
  // @ts-expect-error invalid runtime command
  expect(() => executeCommand(state, state.revision, 0, { type: 'RUN_AWAY' })).toThrow();
  for (const seat of [-1, 2, 0.5]) {
    expect(() => executeCommand(state, state.revision, seat, { type: 'REQUEST_RAISE' })).toThrow();
    expect(() => startMatch(2, seat, identity)).toThrow();
  }
  expect(() => startMatch(2, 0, [])).toThrow();
  expect(state).toEqual(before);
  const ended = finishCards(state);
  const endedBefore = structuredClone(ended);
  expect(() => dealNextHand(ended, ended.revision - 1, identity)).toThrow('STALE_REVISION');
  expect(() => dealNextHand(ended, ended.revision, [])).toThrow();
  expect(ended).toEqual(endedBefore);
});
