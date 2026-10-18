import { createBetting } from '../betting/betting';
import { assertSeat, dealHand, type PlayerCount, shuffleDeck } from '../cards/deal';
import type { PowerSetup } from '../powers/powers';
import { initializePowers } from '../powers/powers';
import type { Team } from '../tricks/resolve-trick';
import type { Hand, MatchState, Score, Transition } from './types';

function createHand(
  count: PlayerCount,
  leader: number,
  number: number,
  score: Score,
  choices: readonly number[],
): Hand {
  const kind =
    score.A === 11 && score.B === 11
      ? 'decisive'
      : score.A === 11 || score.B === 11
        ? 'eleven'
        : 'normal';
  return {
    ...dealHand(shuffleDeck(choices), count, leader),
    number,
    kind,
    leader,
    elevenTeam: kind === 'eleven' ? (score.A === 11 ? 'A' : 'B') : null,
    trickLeader: leader,
    plays: [],
    completedTricks: [],
    betting: { ...createBetting(), acceptedStake: kind === 'normal' ? 1 : 3 },
  };
}

function beginHand(state: MatchState, setup?: PowerSetup): Transition {
  state = initializePowers(state, setup);
  const { hand } = state;
  return {
    state: {
      ...state,
      phase:
        hand.elevenTeam === null
          ? state.powers && hand.kind === 'normal'
            ? { type: 'PREPARATION' }
            : { type: 'TURN', seat: hand.leader }
          : { type: 'ELEVEN_DECISION', team: hand.elevenTeam },
    },
    events: [{ type: 'HAND_STARTED', handNumber: hand.number, kind: hand.kind }],
  };
}

/** Trusted application inputs only: the adapter samples the initial leader and shuffle. */
export function startMatch(
  playerCount: PlayerCount,
  leader: number,
  choices: readonly number[],
  setup?: PowerSetup,
): Transition {
  assertSeat(leader, playerCount);
  const score: Score = { A: 0, B: 0 };
  const hand = createHand(playerCount, leader, 1, score, choices);
  return beginHand(
    {
      playerCount,
      revision: 0,
      score,
      hand,
      phase: { type: 'TURN', seat: leader },
    },
    setup,
  );
}

export function assertRevision(state: MatchState, expectedRevision: number): void {
  if (expectedRevision !== state.revision) throw new Error('STALE_REVISION');
}

export function dealNextHand(
  state: MatchState,
  expectedRevision: number,
  choices: readonly number[],
  setup?: PowerSetup,
): Transition {
  assertRevision(state, expectedRevision);
  if (state.phase.type !== 'HAND_END') throw new Error('INVALID_PHASE');
  const leader = (state.hand.leader + 1) % state.playerCount;
  const hand = createHand(state.playerCount, leader, state.hand.number + 1, state.score, choices);
  return beginHand({ ...state, revision: state.revision + 1, hand }, setup);
}

export function finishHand(state: MatchState, winner: Team | 'tie', reward: number): Transition {
  const score =
    winner === 'tie'
      ? state.score
      : { ...state.score, [winner]: Math.min(12, state.score[winner] + reward) };
  const ended = winner !== 'tie' && score[winner] === 12;
  return {
    state: {
      ...state,
      revision: state.revision + 1,
      score,
      phase: ended ? { type: 'MATCH_END', winner } : { type: 'HAND_END', winner, reward },
    },
    events: [
      { type: 'HAND_ENDED', winner, reward, score },
      ...(ended ? [{ type: 'MATCH_ENDED' as const, winner }] : []),
    ],
  };
}
