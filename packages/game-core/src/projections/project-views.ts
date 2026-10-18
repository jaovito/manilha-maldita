import type { BettingState } from '../betting/betting';
import type { Card } from '../cards/cards';
import { assertSeat, type PlayerCount } from '../cards/deal';
import type { HandKind, MatchState, Phase, Score } from '../match/types';
import type { Play, Team, TrickResult } from '../tricks/resolve-trick';

export type ProjectedHand =
  | Readonly<{ seat: number; count: number; visibility: 'hidden' }>
  | Readonly<{ seat: number; count: number; visibility: 'visible'; cards: readonly Card[] }>;
export type ProjectedPlay =
  | Readonly<{ seat: number; covered: true }>
  | Readonly<{ seat: number; covered: boolean; card: Card }>;
export type PublicView = Readonly<{
  playerCount: PlayerCount;
  revision: number;
  score: Score;
  phase: Phase;
  hand: Readonly<{
    number: number;
    kind: HandKind;
    leader: number;
    elevenTeam: Team | null;
    hands: readonly ProjectedHand[];
    vira: Card;
    trickLeader: number;
    plays: readonly ProjectedPlay[];
    completedTricks: readonly Readonly<{
      leader: number;
      plays: readonly ProjectedPlay[];
      result: TrickResult;
    }>[];
    betting: BettingState;
  }>;
}>;
export type PlayerView = PublicView & Readonly<{ seat: number }>;

function projectCard(card: Card): Card {
  return { rank: card.rank, suit: card.suit };
}

function projectPhase(phase: Phase): Phase {
  switch (phase.type) {
    case 'TURN':
      return { type: phase.type, seat: phase.seat };
    case 'RAISE_RESPONSE':
      return { type: phase.type };
    case 'ELEVEN_DECISION':
      return { type: phase.type, team: phase.team };
    case 'HAND_END':
      return { type: phase.type, winner: phase.winner, reward: phase.reward };
    case 'MATCH_END':
      return { type: phase.type, winner: phase.winner };
  }
}

function projectPlay(play: Play, viewer: number | null): ProjectedPlay {
  if (play.covered && play.seat !== viewer) return { seat: play.seat, covered: true };
  return { seat: play.seat, covered: play.covered, card: projectCard(play.card) };
}

function projectView(state: MatchState, viewer: number | null): PublicView {
  const hand = state.hand;
  const betting = hand.betting;
  return {
    playerCount: state.playerCount,
    revision: state.revision,
    score: { A: state.score.A, B: state.score.B },
    phase: projectPhase(state.phase),
    hand: {
      number: hand.number,
      kind: hand.kind,
      leader: hand.leader,
      elevenTeam: hand.elevenTeam,
      hands: hand.hands.map((cards, seat): ProjectedHand => {
        // Eleven reveals a partner's hand once; later phases cannot erase that knowledge.
        const sharedEleven =
          hand.kind === 'eleven' &&
          hand.elevenTeam === (seat % 2 === 0 ? 'A' : 'B') &&
          viewer !== null &&
          viewer % 2 === seat % 2;
        if (seat === viewer || sharedEleven) {
          return {
            seat,
            count: cards.length,
            visibility: 'visible',
            cards: cards.map(projectCard),
          };
        }
        return { seat, count: cards.length, visibility: 'hidden' };
      }),
      vira: projectCard(hand.vira),
      trickLeader: hand.trickLeader,
      plays: hand.plays.map((play) => projectPlay(play, viewer)),
      completedTricks: hand.completedTricks.map((trick) => ({
        leader: trick.leader,
        plays: trick.plays.map((play) => projectPlay(play, viewer)),
        result: { winner: trick.result.winner, nextLeader: trick.result.nextLeader },
      })),
      betting: {
        acceptedStake: betting.acceptedStake,
        pendingStake: betting.pendingStake,
        lastRaisingTeam: betting.lastRaisingTeam,
        resumeTurnSeat: betting.resumeTurnSeat,
      },
    },
  };
}

/** Public information only; private state is never copied and redacted afterward. */
export function projectPublicView(state: MatchState): PublicView {
  return projectView(state, null);
}

/** The caller must authenticate seat ownership before requesting this projection. */
export function projectPlayerView(state: MatchState, seat: number): PlayerView {
  assertSeat(seat, state.playerCount);
  return { ...projectView(state, seat), seat };
}
