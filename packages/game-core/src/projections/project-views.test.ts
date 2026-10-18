import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { type Card, createDeck } from '../cards/cards';
import { type PlayerCount, dealHand, shuffleDeck } from '../cards/deal';
import type { HandKind, MatchState, Phase } from '../match/types';
import { projectPlayerView, projectPublicView } from './project-views';

function fixture(playerCount: PlayerCount = 4): MatchState {
  return {
    playerCount,
    revision: 7,
    score: { A: 2, B: 3 },
    phase: { type: 'TURN', seat: 0 },
    hand: {
      ...dealHand(createDeck(), playerCount, 0),
      number: 1,
      kind: 'normal',
      leader: 0,
      elevenTeam: null,
      trickLeader: 0,
      plays: [],
      completedTricks: [],
      betting: {
        acceptedStake: 1,
        pendingStake: null,
        lastRaisingTeam: null,
        resumeTurnSeat: null,
      },
    },
  };
}

test('public and every seat expose only the authorized remaining hands in both formats', () => {
  for (const count of [2, 4] as const) {
    const state = fixture(count);
    const original = structuredClone(state);
    const publicView = projectPublicView(state);
    expect(publicView.hand.hands).toEqual(
      Array.from({ length: count }, (_, seat) => ({ seat, count: 3, visibility: 'hidden' })),
    );
    expect(publicView.hand).not.toHaveProperty('stock');
    expect(publicView.hand.vira).toEqual(state.hand.vira);
    for (let seat = 0; seat < count; seat++) {
      const view = projectPlayerView(state, seat);
      expect(view.seat).toBe(seat);
      for (const hand of view.hand.hands) {
        expect(hand.visibility).toBe(hand.seat === seat ? 'visible' : 'hidden');
        if (hand.visibility === 'visible') {
          expect<readonly Card[] | undefined>(hand.cards).toEqual(state.hand.hands[seat]);
        } else expect(hand).not.toHaveProperty('cards');
      }
      expect(view.score).not.toBe(state.score);
      expect(view.phase).not.toBe(state.phase);
      expect(view.hand.vira).not.toBe(state.hand.vira);
      expect(view.hand.betting).not.toBe(state.hand.betting);
    }
    expect(state).toEqual(original);
  }
});

const phases: readonly Phase[] = [
  { type: 'ELEVEN_DECISION', team: 'A' },
  { type: 'TURN', seat: 0 },
  { type: 'RAISE_RESPONSE' },
  { type: 'HAND_END', winner: 'A', reward: 3 },
  { type: 'HAND_END', winner: 'tie', reward: 0 },
  { type: 'MATCH_END', winner: 'B' },
];

test('eleven shares only the deciding team partner cards and retains knowledge after decision', () => {
  for (const team of ['A', 'B'] as const) {
    for (const phase of phases) {
      const base = fixture();
      const state: MatchState = {
        ...base,
        phase,
        hand: { ...base.hand, kind: 'eleven', elevenTeam: team },
      };
      for (let viewer = 0; viewer < 4; viewer++) {
        const view = projectPlayerView(state, viewer);
        for (const hand of view.hand.hands) {
          const own = viewer === hand.seat;
          const teammate = viewer % 2 === hand.seat % 2;
          const decidingTeam = (viewer % 2 === 0 ? 'A' : 'B') === team;
          expect(hand.visibility).toBe(own || (teammate && decidingTeam) ? 'visible' : 'hidden');
        }
      }
      expect(
        projectPublicView(state).hand.hands.every((hand) => hand.visibility === 'hidden'),
      ).toBe(true);
    }
  }
});

test('decisive hands and normal hands never share partner cards, even at match end', () => {
  for (const kind of ['normal', 'decisive'] satisfies HandKind[]) {
    for (const phase of phases) {
      const base = fixture();
      const state: MatchState = { ...base, phase, hand: { ...base.hand, kind } };
      expect(projectPublicView(state).phase).toEqual(phase);
      for (let viewer = 0; viewer < 4; viewer++) {
        expect(
          projectPlayerView(state, viewer).hand.hands.filter(
            (hand) => hand.visibility === 'visible',
          ),
        ).toHaveLength(1);
      }
    }
  }
});

test('covered cards remain hidden in the current and completed tricks through all phases', () => {
  const base = fixture();
  const plays = [
    { seat: 0, covered: true, card: { rank: 'A', suit: 'clubs' } },
    { seat: 1, covered: false, card: { rank: '3', suit: 'hearts' } },
  ] as const;
  for (const phase of phases) {
    const state: MatchState = {
      ...base,
      phase,
      hand: {
        ...base.hand,
        plays,
        completedTricks: [{ leader: 0, plays, result: { winner: 'B', nextLeader: 1 } }],
      },
    };
    for (const view of [
      projectPublicView(state),
      ...[0, 1, 2, 3].map((seat) => projectPlayerView(state, seat)),
    ]) {
      const owner = 'seat' in view && view.seat === 0;
      for (const projected of [view.hand.plays, view.hand.completedTricks[0]?.plays]) {
        expect(projected?.[0]).toEqual(owner ? plays[0] : { seat: 0, covered: true });
        expect(projected?.[1]).toEqual(plays[1]);
      }
    }
  }
});

test('allowlists discard unexpected secrets on all nested public objects', () => {
  const base = fixture();
  const card = { rank: 'A', suit: 'clubs', id: 'PRIVATE', token: 'PRIVATE' } as const;
  const play = { seat: 0, card, covered: false, seed: 'PRIVATE' };
  const state = {
    ...base,
    token: 'PRIVATE',
    score: { ...base.score, secret: 'PRIVATE' },
    phase: { type: 'TURN', seat: 0, secret: 'PRIVATE' } as const,
    hand: {
      ...base.hand,
      vira: card,
      hands: [[card], [], [], []],
      seed: 'PRIVATE',
      betting: { ...base.hand.betting, secret: 'PRIVATE' },
      plays: [play],
      completedTricks: [
        {
          leader: 0,
          plays: [play],
          result: { winner: 'A', nextLeader: 0, secret: 'PRIVATE' } as const,
          secret: 'PRIVATE',
        },
      ],
    },
  };
  for (const view of [projectPublicView(state), projectPlayerView(state, 0)]) {
    expect(JSON.stringify(view)).not.toContain('PRIVATE');
  }
});

test('generated hidden hands, stock and covered identities cannot change unauthorized snapshots', () => {
  const choices = fc.tuple(
    ...Array.from({ length: 39 }, (_, index) => fc.integer({ min: 0, max: 39 - index })),
  );
  fc.assert(
    fc.property(choices, fc.integer({ min: 0, max: 3 }), (indices, viewer) => {
      const base = fixture();
      const shuffled = dealHand(shuffleDeck(indices), 4, 0);
      const covered: Card = shuffled.vira;
      const state: MatchState = {
        ...base,
        hand: {
          ...base.hand,
          ...shuffled,
          plays: [{ seat: (viewer + 1) % 4, covered: true, card: covered }],
        },
      };
      const alternate: MatchState = {
        ...state,
        hand: {
          ...state.hand,
          stock: [],
          hands: state.hand.hands.map((hand, seat) =>
            seat === viewer ? hand : hand.map(() => ({ rank: '3', suit: 'clubs' })),
          ),
          plays: [{ seat: (viewer + 1) % 4, covered: true, card: { rank: '2', suit: 'diamonds' } }],
        },
      };
      expect(projectPublicView(state)).toEqual(projectPublicView(alternate));
      expect(projectPlayerView(state, viewer)).toEqual(projectPlayerView(alternate, viewer));
    }),
    { seed: 20261018, numRuns: 100 },
  );
});

test('invalid viewer seats are rejected with a stable error', () => {
  for (const count of [2, 4] as const) {
    for (const seat of [-1, count, 0.5, NaN, Infinity]) {
      expect(() => projectPlayerView(fixture(count), seat)).toThrow('INVALID_SEAT');
    }
  }
});
