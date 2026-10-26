import { expect, test } from 'bun:test';
import { startMatch } from '@truco/game-core/match';
import { projectPlayerView, type PlayerView } from '@truco/game-core/projections';
import { chooseAction } from './policy';
import { trainingRaises } from './training-policy';

function view(strong = true): PlayerView {
  const projected = projectPlayerView(startMatch(2, 0, Array(39).fill(0)).state, 0);

  return {
    ...projected,
    hand: {
      ...projected.hand,
      vira: { rank: '3', suit: 'diamonds' },
      hands: [
        {
          seat: 0,
          visibility: 'visible',
          count: 3,
          cards: strong
            ? [
                { rank: '4', suit: 'clubs' },
                { rank: '4', suit: 'hearts' },
                { rank: '3', suit: 'spades' },
              ]
            : [
                { rank: '5', suit: 'clubs' },
                { rank: '6', suit: 'hearts' },
                { rank: '7', suit: 'spades' },
              ],
        },
        { seat: 1, count: 3, visibility: 'hidden' },
      ],
    },
  };
}

test('training initiates and counters every legal raise level with strong cards, respecting ceiling and rights', () => {
  const base = view();
  for (const acceptedStake of [1, 3, 6, 9] as const) {
    const current = {
      ...base,
      hand: {
        ...base.hand,
        betting: {
          ...base.hand.betting,
          acceptedStake,
          lastRaisingTeam: acceptedStake === 1 ? null : ('B' as const),
        },
      },
    };
    expect(chooseAction(current, 'training', 0.3)).toEqual({ type: 'REQUEST_RAISE' });
    expect(
      chooseAction(
        {
          ...current,
          hand: {
            ...current.hand,
            betting: {
              ...current.hand.betting,
              lastRaisingTeam: 'A',
            },
          },
        },
        'training',
        0.3,
      ).type,
    ).toBe('PLAY_CARD');
  }
  for (const pendingStake of [3, 6, 9, 12] as const) {
    expect(
      chooseAction(
        {
          ...base,
          phase: { type: 'RAISE_RESPONSE' },
          hand: {
            ...base.hand,
            betting: { ...base.hand.betting, pendingStake },
          },
        },
        'training',
        0.3,
      ),
    ).toEqual({ type: 'RESPOND_RAISE', response: pendingStake === 12 ? 'accept' : 'raise' });
  }
  expect(
    chooseAction(
      {
        ...base,
        hand: {
          ...base.hand,
          betting: {
            ...base.hand.betting,
            acceptedStake: 12,
          },
        },
      },
      'training',
      0.3,
    ).type,
  ).toBe('PLAY_CARD');
  expect(
    chooseAction({ ...base, hand: { ...base.hand, kind: 'decisive' } }, 'training', 0.3).type,
  ).toBe('PLAY_CARD');
});

test('training mixes strong raises, restrained weak hands and rare bluffs without reading hidden cards', () => {
  expect(trainingRaises(view(), 0.79)).toBe(true);
  expect(trainingRaises(view(), 0.8)).toBe(false);
  expect(trainingRaises(view(false), 0.5)).toBe(false);
  expect(trainingRaises(view(false), 0.03)).toBe(true);
  const weak = view(false);
  expect(chooseAction({ ...weak, phase: { type: 'RAISE_RESPONSE' } }, 'training', 0.5)).toEqual({
    type: 'RESPOND_RAISE',
    response: 'fold',
  });
  const state = startMatch(2, 0, Array(39).fill(0)).state;
  const changed = {
    ...state,
    hand: {
      ...state.hand,
      stock: [...state.hand.stock].reverse(),
      hands: [state.hand.hands[0] ?? [], [...(state.hand.hands[1] ?? [])].reverse()],
    },
  };
  expect(chooseAction(projectPlayerView(state, 0), 'training', 0.3)).toEqual(
    chooseAction(projectPlayerView(changed, 0), 'training', 0.3),
  );
  expect(trainingRaises({ ...weak, hand: { ...weak.hand, hands: [] } }, 0)).toBe(false);
});

test('training values a public trick win and declines a confident raise against a stronger public play', () => {
  const base = view();
  const own = base.hand.hands[0];
  if (own?.visibility !== 'visible' || !own.cards[0]) throw new Error('MISSING_CARD');
  const one = {
    ...base,
    hand: {
      ...base.hand,
      hands: [{ ...own, count: 1, cards: [own.cards[0]] }],
      completedTricks: [{ leader: 0, plays: [], result: { winner: 'A' as const, nextLeader: 0 } }],
    },
  };
  expect(trainingRaises(one, 0.4)).toBe(true);
  const exposed = {
    ...view(false),
    hand: {
      ...view(false).hand,
      plays: [
        {
          seat: 1,
          covered: false as const,
          card: { rank: '4' as const, suit: 'clubs' as const },
          power: 'boost' as const,
        },
      ],
      betting: { ...base.hand.betting, acceptedStake: 9 as const },
    },
  };
  expect(trainingRaises(exposed, 0.3)).toBe(false);
  expect(trainingRaises(exposed, 0.005)).toBe(true);
});
