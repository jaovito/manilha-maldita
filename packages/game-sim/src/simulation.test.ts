import { expect, test } from 'bun:test';
import { startMatch } from '@truco/game-core/match';
import { projectPlayerView } from '@truco/game-core/projections';
import { chooseAction } from './policy';
import { compare, random, simulate } from './simulation';

test('simulations finish reproducibly across policies, formats, presets and paired swaps', () => {
  const report = compare(2, 317);
  expect(report).toEqual(compare(2, 317));
  expect(report.reports).toHaveLength(12);
  for (const row of report.reports) {
    expect(row.poweredMatches).toBe(4);
    expect(row.meanHands).toBeGreaterThan(0);
    expect(row.starterWinRate).toBeGreaterThanOrEqual(0);
    expect(row.starterWinRate).toBeLessThanOrEqual(1);
    expect(row.approximate95Interval[0]).toBeLessThanOrEqual(row.pairedStarterEffect);
    expect(row.approximate95Interval[1]).toBeGreaterThanOrEqual(row.pairedStarterEffect);
    for (const [power, count] of Object.entries(row.uses))
      expect(count).toBeLessThanOrEqual(row.assignments[power] ?? 0);
  }
  const scenario = {
    seed: 42,
    count: 4,
    preset: 'competitive',
    policy: 'conservative',
    mirrored: false,
    powers: true,
  } as const;
  expect(simulate(scenario).winner).not.toBe(simulate({ ...scenario, mirrored: true }).winner);
  for (const samples of [0, 1, 10001, 1.5])
    expect(() => compare(samples, 1)).toThrow('INVALID_SIMULATION_CONFIG');
  expect(() => compare(2, NaN)).toThrow('INVALID_SIMULATION_CONFIG');
});

test('policies act only on authorized observations, handle empty response hands and reject malformed inputs', () => {
  const state = startMatch(
    2,
    0,
    Array.from({ length: 39 }, (_, i) => 39 - i),
  ).state;
  const view = projectPlayerView(state, 0);
  expect(chooseAction(view, 'conservative', 0)).toMatchObject({ type: 'PLAY_CARD' });
  const changed = projectPlayerView(
    {
      ...state,
      hand: {
        ...state.hand,
        stock: [...state.hand.stock].reverse(),
        hands: [state.hand.hands[0] ?? [], [...(state.hand.hands[1] ?? [])].reverse()],
      },
    },
    0,
  );
  expect(chooseAction(changed, 'probabilistic', 0.4)).toEqual(
    chooseAction(view, 'probabilistic', 0.4),
  );
  expect(
    chooseAction(
      {
        ...view,
        phase: { type: 'RAISE_RESPONSE' },
        hand: { ...view.hand, hands: [{ seat: 0, count: 0, visibility: 'visible', cards: [] }] },
      },
      'conservative',
      0,
    ),
  ).toEqual({ type: 'RESPOND_RAISE', response: 'fold' });
  expect(() => chooseAction(view, 'conservative', -1)).toThrow('INVALID_POLICY_INPUT');
  expect(() =>
    chooseAction({ ...view, phase: { type: 'MATCH_END', winner: 'A' } }, 'conservative', 0),
  ).toThrow('INVALID_POLICY_INPUT');
  const left = random(10),
    right = random(10);
  for (let i = 0; i < 20; i++) expect(left()).toBe(right());
});
