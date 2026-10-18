import { expect, test } from 'bun:test';
import { cardStrength } from '../cards/cards';
import { finishHand } from '../match/lifecycle';
import { dealNextHand } from '../match/match';
import { projectPlayerView, projectPublicView } from '../projections/project-views';
import { POWER_IDS, type Power } from './powers';
import { act, begin, card, commit, passAll, setup, shuffle } from '../../tests/powers-fixture';

for (const draws of [
  [0, 1],
  [0, 1, 2, 3],
]) {
  test(`${draws.length} seats: only the owner sees an unused power, including partner and public projections`, () => {
    const state = begin(draws);
    if (!state.powers) throw new Error('NO_POWERS');
    expect(projectPublicView(state).powers?.players.map((player) => player.power)).toEqual(
      draws.map(() => null),
    );

    for (let viewer = 0; viewer < draws.length; viewer++) {
      const original = projectPlayerView(state, viewer);
      expect(original.powers?.players.map((player) => player.power)).toEqual(
        state.powers.slots.map((power, seat) => (seat === viewer ? power : null)),
      );
      for (let other = 0; other < draws.length; other++) {
        if (viewer === other) continue;
        for (const power of POWER_IDS) {
          const different = {
            ...state,
            powers: {
              ...state.powers,
              slots: state.powers.slots.map((slot, seat) => (seat === other ? power : slot)),
            },
          };
          expect(projectPlayerView(different, viewer)).toEqual(original);
          expect(projectPublicView(different)).toEqual(projectPublicView(state));
        }
      }
    }
  });
}

test('preparation reveals only actual activations after the sealed batch, never unused assignments at hand or match end', () => {
  const initial = begin([0, 1, 2, 3]);
  let state = commit(initial, 0, { type: 'spy', target: 1 });
  state = commit(state, 1, { type: 'exchange', card: card(initial, 1) });
  state = commit(state, 2, { type: 'pass' });
  expect(projectPublicView(state).powers?.players.map((player) => player.power)).toEqual([
    null,
    null,
    null,
    null,
  ]);
  expect(projectPlayerView(state, 3).powers?.intel).toBeNull();
  state = commit(state, 3, { type: 'pass' });
  const publicPowers: (Power | null)[] = ['spy', 'exchange', null, null];
  expect(projectPublicView(state).powers?.players.map((player) => player.power)).toEqual(
    publicPowers,
  );
  for (let viewer = 0; viewer < 4; viewer++) {
    const view = projectPlayerView(state, viewer);
    expect(view.powers?.players.map((player) => player.power)).toEqual(
      publicPowers.map((power, seat) =>
        seat === viewer ? (initial.powers?.slots[seat] ?? null) : power,
      ),
    );
    if (viewer === 0) expect(view.powers?.intel).not.toBeNull();
    else expect(view.powers?.intel).toBeNull();
  }

  const ended = finishHand(state, 'A', 1).state;
  expect(projectPublicView(ended).powers?.players.map((player) => player.power)).toEqual(
    publicPowers,
  );
  const won = finishHand({ ...state, score: { A: 11, B: 0 } }, 'A', 1).state;
  expect(won.phase.type).toBe('MATCH_END');
  expect(projectPublicView(won).powers?.players.map((player) => player.power)).toEqual(
    publicPowers,
  );
  const next = dealNextHand(ended, ended.revision, shuffle, setup([0, 1, 2, 3])).state;
  expect(projectPublicView(next).powers?.players.map((player) => player.power)).toEqual([
    null,
    null,
    null,
    null,
  ]);
  expect(projectPublicView(next).powers?.activations).toEqual([]);
});

for (const power of ['boost', 'mask'] as const) {
  test(`${power}: rejected use stays private; accepted play reveals the power without leaking a masked card`, () => {
    let state = passAll(begin([power === 'boost' ? 2 : 3, 1, 0, 2]));
    const original = projectPublicView(state);
    expect(() =>
      act(state, 0, { type: 'PLAY_CARD', card: card(state, 0), covered: true, power }),
    ).toThrow('INVALID_COVERED_PLAY');
    expect(projectPublicView(state)).toEqual(original);
    const chosen = state.hand.hands[0]?.find(
      (candidate) => cardStrength(candidate, state.hand.vira) < 9,
    );
    if (!chosen) throw new Error('NO_COMMON_CARD');
    state = act(state, 0, { type: 'PLAY_CARD', card: chosen, covered: false, power });
    expect(projectPublicView(state).powers?.players.map((player) => player.power)).toEqual([
      power,
      null,
      null,
      null,
    ]);
    for (let viewer = 1; viewer < 4; viewer++) {
      const view = projectPlayerView(state, viewer);
      expect(view.powers?.players[0]?.power).toBe(power);
      expect(view.powers?.activations).toEqual([{ seat: 0, power, target: 0 }]);
      if (power === 'mask')
        expect(view.hand.plays[0]).toEqual({ seat: 0, covered: false, power: 'mask' });
    }
  });
}
