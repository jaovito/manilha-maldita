import { expect, test } from 'bun:test';
import fc from 'fast-check';
import type { Team } from '../tricks/resolve-trick';
import { type BettingState, createBetting, requestRaise, respondRaise } from './betting';

function counter(state: BettingState, team: Team): BettingState {
  const result = respondRaise(state, team, 'raise');
  if (result.kind !== 'continue') throw new Error('EXPECTED_CONTINUE');
  return result.betting;
}

test('offers, accepts and alternates the right to raise without changing the saved turn', () => {
  const initial = Object.freeze(createBetting());
  expect(initial).toEqual({
    acceptedStake: 1,
    pendingStake: null,
    lastRaisingTeam: null,
    resumeTurnSeat: null,
  });
  const offer = Object.freeze(requestRaise(initial, 'A', 2));
  expect(offer).toEqual({
    acceptedStake: 1,
    pendingStake: 3,
    lastRaisingTeam: 'A',
    resumeTurnSeat: 2,
  });
  expect(respondRaise(offer, 'B', 'accept')).toEqual({
    kind: 'continue',
    betting: { acceptedStake: 3, pendingStake: null, lastRaisingTeam: 'A', resumeTurnSeat: null },
  });
  const acceptance = respondRaise(offer, 'B', 'accept');
  if (acceptance.kind !== 'continue') throw new Error('EXPECTED_CONTINUE');
  expect(() => requestRaise(acceptance.betting, 'A', 0)).toThrow('TEAM_CANNOT_RAISE');
  expect(requestRaise(acceptance.betting, 'B', 3)).toEqual({
    acceptedStake: 3,
    pendingStake: 6,
    lastRaisingTeam: 'B',
    resumeTurnSeat: 3,
  });
  expect(initial.acceptedStake).toBe(1);
  expect(offer.pendingStake).toBe(3);
});

test('counter-raising accepts the previous offer and folds award only the accepted stake', () => {
  for (const team of ['A', 'B'] as const) {
    const other = team === 'A' ? 'B' : 'A';
    const offer = Object.freeze(requestRaise(createBetting(), team, team === 'A' ? 0 : 1));
    expect(respondRaise(offer, other, 'fold')).toEqual({ kind: 'fold', winner: team, reward: 1 });
    const six = Object.freeze(counter(offer, other));
    expect(six.acceptedStake).toBe(3);
    expect(six.pendingStake).toBe(6);
    expect(six.resumeTurnSeat).toBe(offer.resumeTurnSeat);
    expect(respondRaise(six, team, 'fold')).toEqual({ kind: 'fold', winner: other, reward: 3 });
    const nine = counter(six, team);
    expect(respondRaise(nine, other, 'fold')).toEqual({ kind: 'fold', winner: team, reward: 6 });
    const twelve = counter(nine, other);
    expect(twelve.acceptedStake).toBe(9);
    expect(twelve.pendingStake).toBe(12);
    expect(() => respondRaise(twelve, team, 'raise')).toThrow('MAXIMUM_STAKE');
    expect(respondRaise(twelve, team, 'fold')).toEqual({ kind: 'fold', winner: other, reward: 9 });
    const acceptance = respondRaise(twelve, team, 'accept');
    if (acceptance.kind !== 'continue') throw new Error('EXPECTED_CONTINUE');
    expect(acceptance.betting.acceptedStake).toBe(12);
    expect(() => requestRaise(acceptance.betting, team, team === 'A' ? 0 : 1)).toThrow(
      'MAXIMUM_STAKE',
    );
  }
});

test('rejects absent, repeated, own-team and malformed actions without mutation', () => {
  const initial = Object.freeze(createBetting());
  const offer = Object.freeze(requestRaise(initial, 'A', 0));
  const before = { ...offer };
  for (const response of ['accept', 'raise', 'fold'] as const) {
    expect(() => respondRaise(initial, 'A', response)).toThrow('NO_PENDING_RAISE');
    expect(() => respondRaise(offer, 'A', response)).toThrow('TEAM_CANNOT_RESPOND');
  }
  expect(() => requestRaise(offer, 'B', 1)).toThrow('RAISE_ALREADY_PENDING');
  expect(() => requestRaise(initial, 'A', 1)).toThrow('INVALID_TEAM_SEAT');
  for (const seat of [-1, 4, 0.5, NaN, Infinity]) {
    expect(() => requestRaise(initial, 'A', seat)).toThrow('INVALID_SEAT');
  }
  // @ts-expect-error untrusted enum
  expect(() => requestRaise(initial, 'C', 0)).toThrow('INVALID_TEAM');
  // @ts-expect-error untrusted enum
  expect(() => respondRaise(offer, 'C', 'accept')).toThrow('INVALID_TEAM');
  // @ts-expect-error untrusted enum
  expect(() => respondRaise(offer, 'B', 'skip')).toThrow('INVALID_RAISE_RESPONSE');
  expect(offer).toEqual(before);
});

test('rejects inconsistent stake, raising team and saved seat states', () => {
  const initial = createBetting();
  const offer = requestRaise(initial, 'A', 0);
  const invalid: BettingState[] = [
    { ...initial, resumeTurnSeat: 0 },
    { ...initial, lastRaisingTeam: 'A' },
    { ...initial, acceptedStake: 3 },
    { ...offer, acceptedStake: 12 },
    { ...offer, pendingStake: 6 },
    { ...offer, lastRaisingTeam: null },
    { ...offer, resumeTurnSeat: null },
    { ...offer, resumeTurnSeat: -1 },
    { ...offer, resumeTurnSeat: 4 },
    { ...offer, resumeTurnSeat: 0.5 },
    // @ts-expect-error untrusted stake
    { ...initial, acceptedStake: 2 },
    // @ts-expect-error untrusted team
    { ...offer, lastRaisingTeam: 'C' },
  ];
  for (const state of invalid) {
    Object.freeze(state);
    expect(() => requestRaise(state, 'A', 0)).toThrow('INVALID_BETTING_STATE');
    expect(() => respondRaise(state, 'B', 'fold')).toThrow('INVALID_BETTING_STATE');
  }
});

test('arbitrary counter-raise prefixes preserve turn and monotonic stake without mutating inputs', () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 }), (seat, count) => {
      let team: Team = seat % 2 === 0 ? 'A' : 'B';
      let state = requestRaise(createBetting(), team, seat);
      for (let index = 0; index < count; index++) {
        const previous = Object.freeze(state);
        const before = { ...previous };
        team = team === 'A' ? 'B' : 'A';
        state = counter(previous, team);
        expect(state.acceptedStake === previous.pendingStake).toBe(true);
        expect(state.pendingStake !== null && state.pendingStake > state.acceptedStake).toBe(true);
        expect(state.resumeTurnSeat).toBe(seat);
        expect(previous).toEqual(before);
      }
      const other = team === 'A' ? 'B' : 'A';
      const accepted = respondRaise(Object.freeze(state), other, 'accept');
      if (accepted.kind !== 'continue') throw new Error('EXPECTED_CONTINUE');
      expect(() => respondRaise(accepted.betting, other, 'accept')).toThrow('NO_PENDING_RAISE');
    }),
  );
});
