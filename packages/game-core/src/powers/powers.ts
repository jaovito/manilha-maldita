import { type Card, cardStrength } from '../cards/cards';
import type { MatchState } from '../match/types';

export const POWER_IDS = ['spy', 'exchange', 'boost', 'mask'] as const;
export type Power = (typeof POWER_IDS)[number];
export type TurnPower = 'boost' | 'mask';
export type PreparationIntent =
  | Readonly<{ type: 'pass' }>
  | Readonly<{ type: 'spy'; target: number }>
  | Readonly<{ type: 'exchange'; card: Card }>;
export type PowerSetup = Readonly<{
  preset: 'casual' | 'competitive';
  draws: readonly number[];
  flips: readonly number[];
  spies: readonly number[];
}>;
export type Activation = Readonly<{ seat: number; power: Power; target: number }>;
export type Powers = Readonly<{
  preset: PowerSetup['preset'];
  energy: readonly number[];
  slots: readonly (Power | null)[];
  used: readonly boolean[];
  commitments: readonly (PreparationIntent | null)[];
  spies: readonly number[];
  intel: readonly (Readonly<{ target: number; card: Card }> | null)[];
  activations: readonly Activation[];
}>;
export const POWER_COST: Readonly<Record<Power, number>> = {
  spy: 1,
  exchange: 2,
  boost: 2,
  mask: 1,
};

/** All draws are trusted, bounded samples, supplied before any player decision. */
export function initializePowers(state: MatchState, setup?: PowerSetup): MatchState {
  if (!setup && !state.powers) return state;

  const count = state.playerCount;
  const previous = state.powers;
  const energy = previous?.energy ?? Array.from({ length: count }, () => 2);

  if (state.hand.kind !== 'normal') {
    if (!previous) return state;
    return {
      ...state,
      powers: {
        ...previous,
        slots: energy.map(() => null),
        used: energy.map(() => false),
        commitments: energy.map(() => null),
        intel: energy.map(() => null),
        activations: [],
      },
    };
  }

  if (
    !setup ||
    (previous && setup.preset !== previous.preset) ||
    setup.draws.length !== count ||
    setup.flips.length !== 2 ||
    setup.spies.length !== count ||
    setup.draws.some((n) => !Number.isInteger(n) || n < 0 || n > 3) ||
    setup.flips.some((n) => n !== 0 && n !== 1) ||
    setup.spies.some((n) => !Number.isInteger(n) || n < 0 || n > 2)
  )
    throw new Error('INVALID_POWER_SETUP');

  let slots = setup.draws.map((n) => POWER_IDS[n] ?? 'spy');
  if (setup.preset === 'competitive') {
    const first = slots[0] ?? 'spy';
    if (count === 2) slots = [first, first];
    else {
      // A bounded rejection-free sample chooses uniformly among the other three powers.
      const remaining = POWER_IDS.filter((power) => power !== first);
      const secondIndex = setup.draws[1];
      if (secondIndex === undefined || secondIndex > 2) throw new Error('INVALID_POWER_SETUP');
      const second = remaining[secondIndex] ?? 'exchange';
      slots = [first, first, second, second];
      for (const team of [0, 1]) {
        if (setup.flips[team] === 1) {
          slots[team] = second;
          slots[team + 2] = first;
        }
      }
    }
  }

  return {
    ...state,
    powers: {
      preset: setup.preset,
      energy: energy.map((value) => Math.min(3, value + (state.hand.number === 1 ? 0 : 1))),
      slots,
      used: energy.map(() => false),
      commitments: energy.map(() => null),
      spies: [...setup.spies],
      intel: energy.map(() => null),
      activations: [],
    },
  };
}

export function assertAvailable(state: MatchState, seat: number, power: Power): Powers {
  const powers = state.powers;
  if (state.hand.kind !== 'normal' || !powers || powers.slots[seat] !== power)
    throw new Error('POWER_UNAVAILABLE');
  if (powers.used[seat]) throw new Error('POWER_ALREADY_USED');
  if ((powers.energy[seat] ?? 0) < POWER_COST[power]) throw new Error('INSUFFICIENT_ENERGY');

  return powers;
}

export function activateTurnPower(
  state: MatchState,
  seat: number,
  card: Card,
  covered: boolean,
  power?: TurnPower,
): Powers | undefined {
  if (power === undefined) return state.powers;
  if (power !== 'boost' && power !== 'mask') throw new Error('POWER_UNAVAILABLE');

  const powers = assertAvailable(state, seat, power);
  if (covered || (power === 'boost' && cardStrength(card, state.hand.vira) >= 9))
    throw new Error('INVALID_POWER_TARGET');

  return {
    ...powers,
    energy: powers.energy.map((value, owner) =>
      owner === seat ? value - POWER_COST[power] : value,
    ),
    used: powers.used.map((value, owner) => owner === seat || value),
    activations: [...powers.activations, { seat, power, target: seat }],
  };
}
