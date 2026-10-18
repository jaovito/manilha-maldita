import type { BettingState, Stake } from '../betting/betting';
import type { Card } from '../cards/cards';
import type { PlayerCount } from '../cards/deal';
import type { PowerSetup, Powers, PreparationIntent, TurnPower } from '../powers/powers';
import type { Play, Team, TrickResult } from '../tricks/resolve-trick';

export type { PowerSetup };
export type Score = Readonly<Record<Team, number>>;
export type HandKind = 'normal' | 'eleven' | 'decisive';
export type CompletedTrick = Readonly<{
  leader: number;
  plays: readonly Play[];
  result: TrickResult;
}>;
export type Hand = Readonly<{
  number: number;
  kind: HandKind;
  leader: number;
  elevenTeam: Team | null;
  hands: readonly (readonly Card[])[];
  vira: Card;
  stock: readonly Card[];
  discards?: readonly Card[];
  trickLeader: number;
  plays: readonly Play[];
  completedTricks: readonly CompletedTrick[];
  betting: BettingState;
}>;
export type Phase =
  | Readonly<{ type: 'PREPARATION' }>
  | Readonly<{ type: 'TURN'; seat: number }>
  | Readonly<{ type: 'RAISE_RESPONSE' }>
  | Readonly<{ type: 'ELEVEN_DECISION'; team: Team }>
  | Readonly<{ type: 'HAND_END'; winner: Team | 'tie'; reward: number }>
  | Readonly<{ type: 'MATCH_END'; winner: Team }>;
export type MatchState = Readonly<{
  powers?: Powers;
  playerCount: PlayerCount;
  revision: number;
  score: Score;
  hand: Hand;
  phase: Phase;
}>;
export type PlayerCommand =
  | Readonly<{ type: 'PREPARE'; intent: PreparationIntent }>
  | Readonly<{ type: 'PLAY_CARD'; card: Card; covered: boolean; power?: TurnPower | undefined }>
  | Readonly<{ type: 'REQUEST_RAISE' }>
  | Readonly<{ type: 'RESPOND_RAISE'; response: 'accept' | 'raise' | 'fold' }>
  | Readonly<{ type: 'DECIDE_ELEVEN'; response: 'play' | 'fold' }>;
export type MatchEvent =
  | Readonly<{ type: 'HAND_STARTED'; handNumber: number; kind: HandKind }>
  | Readonly<{ type: 'TRICK_ENDED'; result: TrickResult }>
  | Readonly<{ type: 'HAND_ENDED'; winner: Team | 'tie'; reward: number; score: Score }>
  | Readonly<{ type: 'MATCH_ENDED'; winner: Team }>
  | Readonly<{ type: 'STAKE_CHANGED'; acceptedStake: Stake; pendingStake: Stake | null }>;
export type Transition = Readonly<{ state: MatchState; events: readonly MatchEvent[] }>;
