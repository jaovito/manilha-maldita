import {
  dealNextHand,
  executeCommand,
  type MatchState,
  type PowerSetup,
  startMatch,
} from '@truco/game-core/match';
import { projectPlayerView } from '@truco/game-core/projections';
import { chooseAction, type Policy } from './policy';

/** Local reproducible PRNG for simulation only; never used by the server. */
export function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}
export type Scenario = Readonly<{
  seed: number;
  count: 2 | 4;
  preset: 'casual' | 'competitive';
  policy: Policy;
  mirrored: boolean;
  powers: boolean;
}>;

export function simulate(scenario: Scenario) {
  const { count, seed, preset, mirrored } = scenario;
  const decisionRandom = random(seed ^ 0x7ab9123);
  function entropy(hand: number) {
    // Per-hand streams keep dealing paired even when policies take different numbers of actions.
    const deck = random(seed + Math.imul(hand, 7919));
    const power = random(seed ^ Math.imul(hand, 104729));
    const draws = Array.from({ length: count }, (_, seat) =>
      Math.floor(power() * (preset === 'competitive' && count === 4 && seat === 1 ? 3 : 4)),
    );
    const flips = [Math.floor(power() * 2), Math.floor(power() * 2)];
    let spies = Array.from({ length: count }, () => Math.floor(power() * 3));
    let assigned = draws;
    if (mirrored) {
      spies = [spies.at(-1) ?? 0, ...spies.slice(0, -1)];
      if (preset === 'casual') assigned = [draws.at(-1) ?? 0, ...draws.slice(0, -1)];
      else flips.reverse();
    }
    const setup: PowerSetup = { preset, draws: assigned, flips, spies };
    return {
      shuffle: Array.from({ length: 39 }, (_, offset) => Math.floor(deck() * (40 - offset))),
      setup,
    };
  }
  const initial = entropy(1);
  const initialLeader = (((seed >>> 0) % count) + (mirrored ? 1 : 0)) % count;
  let state = startMatch(
    count,
    initialLeader,
    initial.shuffle,
    scenario.powers ? initial.setup : undefined,
  ).state;
  const assignments: Record<string, number> = {};
  const uses: Record<string, number> = {};
  let countedHand = 0;
  for (let decisions = 0; decisions < 5000; decisions++) {
    if (state.hand.number !== countedHand) {
      countedHand = state.hand.number;
      for (const power of state.powers?.slots ?? [])
        if (power) assignments[power] = (assignments[power] ?? 0) + 1;
    }
    if (state.phase.type === 'MATCH_END')
      return {
        winner: state.phase.winner,
        starterWon: state.phase.winner === (initialLeader % 2 === 0 ? 'A' : 'B'),
        hands: state.hand.number,
        decisions,
        assignments,
        uses,
      };
    if (state.phase.type === 'HAND_END') {
      const next = entropy(state.hand.number + 1);
      state = dealNextHand(
        state,
        state.revision,
        next.shuffle,
        scenario.powers ? next.setup : undefined,
      ).state;
      continue;
    }
    const seat = actorSeat(state);
    const view = projectPlayerView(state, seat);
    const action = chooseAction(view, scenario.policy, decisionRandom());
    const before = state.powers?.activations.length ?? 0;
    state = executeCommand(state, state.revision, seat, action).state;
    for (const activation of state.powers?.activations.slice(before) ?? [])
      uses[activation.power] = (uses[activation.power] ?? 0) + 1;
  }
  throw new Error('SIMULATION_LIMIT');
}

function actorSeat(state: MatchState): number {
  switch (state.phase.type) {
    case 'PREPARATION': {
      const seat = state.powers?.commitments.indexOf(null);
      if (seat === undefined || seat < 0) throw new Error('INVALID_PHASE');
      return seat;
    }
    case 'TURN':
      return state.phase.seat;
    case 'ELEVEN_DECISION':
      return state.phase.team === 'A' ? 0 : 1;
    case 'RAISE_RESPONSE':
      return state.hand.betting.lastRaisingTeam === 'A' ? 1 : 0;
    default:
      throw new Error('INVALID_PHASE');
  }
}

export function compare(samples: number, seed: number) {
  if (!Number.isInteger(samples) || samples < 2 || samples > 10000 || !Number.isSafeInteger(seed))
    throw new Error('INVALID_SIMULATION_CONFIG');
  const reports = [];
  for (const count of [2, 4] as const)
    for (const preset of ['casual', 'competitive'] as const)
      for (const policy of ['conservative', 'aggressive', 'probabilistic'] as const) {
        const pairs = [];
        let hands = 0,
          decisions = 0;
        const assignments: Record<string, number> = {},
          uses: Record<string, number> = {};
        for (let index = 0; index < samples; index++) {
          let difference = 0,
            starter = 0;
          for (const mirrored of [false, true]) {
            const scenario = { seed: seed + index, count, preset, policy, mirrored };
            const baseline = simulate({ ...scenario, powers: false });
            const powered = simulate({ ...scenario, powers: true });
            difference += Number(powered.starterWon) - Number(baseline.starterWon);
            starter += Number(powered.starterWon);
            hands += powered.hands;
            decisions += powered.decisions;
            for (const [power, total] of Object.entries(powered.assignments))
              assignments[power] = (assignments[power] ?? 0) + total;
            for (const [power, total] of Object.entries(powered.uses))
              uses[power] = (uses[power] ?? 0) + total;
          }
          pairs.push({ difference: difference / 2, starter: starter / 2 });
        }
        const mean = pairs.reduce((sum, pair) => sum + pair.difference, 0) / samples;
        const variance =
          pairs.reduce((sum, pair) => sum + (pair.difference - mean) ** 2, 0) / (samples - 1);
        const error = 1.96 * Math.sqrt(variance / samples);
        reports.push({
          count,
          preset,
          policy,
          pairs: samples,
          poweredMatches: samples * 2,
          meanHands: hands / (samples * 2),
          meanDecisions: decisions / (samples * 2),
          starterWinRate: pairs.reduce((sum, pair) => sum + pair.starter, 0) / samples,
          pairedStarterEffect: mean,
          approximate95Interval: [Math.max(-1, mean - error), Math.min(1, mean + error)],
          assignments,
          uses,
        });
      }
  return {
    rulesVersion: 'm3-v1',
    reports,
    caveat:
      'Amostra pareada com troca de assentos/equipes. IC normal aproximado por par; políticas sintéticas não validam diversão ou equilíbrio. Usos são seleção, não efeito causal individual.',
  };
}
