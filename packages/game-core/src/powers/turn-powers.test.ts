import { expect, test } from 'bun:test';
import { cardKey } from '../cards/cards';
import { startMatch } from '../match/match';
import { projectPlayerView, projectPublicView } from '../projections/project-views';
import { act, begin, card, passAll, setup, shuffle } from '../../tests/powers-fixture';

test('mask hides even a manilha from partner until resolution, reveals at resolution and stays hidden on fold', () => {
  let state = passAll(begin([3, 3, 3, 3]));
  state = {
    ...state,
    hand: {
      ...state.hand,
      vira: { rank: '3', suit: 'clubs' },
      stock: state.hand.stock.map((candidate) =>
        cardKey(candidate) === '3:clubs' ? state.hand.vira : candidate,
      ),
    },
  };
  const firstCard = card(state, 0);
  state = act(state, 0, { type: 'PLAY_CARD', card: firstCard, covered: false, power: 'mask' });
  expect(projectPlayerView(state, 0).hand.plays[0]).toHaveProperty('card', firstCard);
  for (const viewer of [1, 2, 3])
    expect(projectPlayerView(state, viewer).hand.plays[0]).toEqual({
      seat: 0,
      covered: false,
      power: 'mask',
    });
  expect(state.powers?.energy[0]).toBe(1);
  const folded = act(act(state, 1, { type: 'REQUEST_RAISE' }), 0, {
    type: 'RESPOND_RAISE',
    response: 'fold',
  });
  expect(projectPlayerView(folded, 2).hand.plays[0]).not.toHaveProperty('card');
  for (const seat of [1, 2, 3])
    state = act(state, seat, { type: 'PLAY_CARD', card: card(state, seat), covered: false });
  expect(projectPublicView(state).hand.completedTricks[0]?.plays[0]).toHaveProperty(
    'card',
    firstCard,
  );
  expect(state.powers?.used[0]).toBe(true);
});

test('boost changes only common strength, cannot create manilha and rejects caps, covers and reuse atomically', () => {
  // Controlled unique cards: vira 4 => manilha 5, boosted 4 ties common 5 strength but remains common.
  let state = passAll(begin([2, 3]));
  state = {
    ...state,
    hand: {
      ...state.hand,
      vira: { rank: '4', suit: 'clubs' },
      hands: [
        [
          { rank: '4', suit: 'diamonds' },
          { rank: '3', suit: 'diamonds' },
          { rank: '5', suit: 'diamonds' },
        ],
        [
          { rank: '5', suit: 'hearts' },
          { rank: '6', suit: 'hearts' },
          { rank: '7', suit: 'hearts' },
        ],
      ],
    },
  };
  const original = structuredClone(state);
  for (const index of [1, 2])
    expect(() =>
      act(state, 0, {
        type: 'PLAY_CARD',
        card: card(state, 0, index),
        covered: false,
        power: 'boost',
      }),
    ).toThrow('INVALID_POWER_TARGET');
  expect(() =>
    act(state, 0, { type: 'PLAY_CARD', card: card(state, 0), covered: true, power: 'boost' }),
  ).toThrow();
  expect(state).toEqual(original);
  state = act(state, 0, {
    type: 'PLAY_CARD',
    card: card(state, 0),
    covered: false,
    power: 'boost',
  });
  state = act(state, 1, { type: 'PLAY_CARD', card: card(state, 1), covered: false });
  expect(state.hand.completedTricks[0]?.result.winner).toBe('B');
  expect(state.powers?.energy[0]).toBe(0);
  expect(state.hand.completedTricks[0]?.plays[0]?.card).toEqual({ rank: '4', suit: 'diamonds' });
  state = act(state, 1, { type: 'PLAY_CARD', card: card(state, 1), covered: false });
  expect(() =>
    act(state, 0, { type: 'PLAY_CARD', card: card(state, 0), covered: false, power: 'boost' }),
  ).toThrow('POWER_ALREADY_USED');
});

test('boost wins one common level and each independent competitive permutation preserves team access', () => {
  let state = passAll(begin([2, 3]));
  const first = card(state, 0);
  state = act(state, 0, { type: 'PLAY_CARD', card: first, covered: false, power: 'boost' });
  state = act(state, 1, { type: 'PLAY_CARD', card: card(state, 1), covered: false });
  expect(state.hand.completedTricks[0]?.result.winner).toBe('A');
  expect(first.rank).toBe('4');
  expect(state.hand.completedTricks[0]?.plays[0]?.card).toEqual(first);
  for (const a of [0, 1])
    for (const b of [0, 1]) {
      const drawn = startMatch(4, 0, shuffle, {
        ...setup([0, 0, 0, 0], 'competitive'),
        flips: [a, b],
      }).state;
      expect([drawn.powers?.slots[0], drawn.powers?.slots[2]].sort()).toEqual(['exchange', 'spy']);
      expect([drawn.powers?.slots[1], drawn.powers?.slots[3]].sort()).toEqual(['exchange', 'spy']);
    }
});
