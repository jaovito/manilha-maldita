import type { Team } from '../tricks/resolve-trick';

export type Stake = 1 | 3 | 6 | 9 | 12;
export type RaiseResponse = 'accept' | 'raise' | 'fold';
export type BettingState = Readonly<{
  acceptedStake: Stake;
  pendingStake: Stake | null;
  lastRaisingTeam: Team | null;
  resumeTurnSeat: number | null;
}>;
export type BettingResult =
  | Readonly<{ kind: 'continue'; betting: BettingState }>
  | Readonly<{ kind: 'fold'; winner: Team; reward: Stake }>;

const STAKES: readonly Stake[] = [1, 3, 6, 9, 12];

function assertTeam(team: Team): void {
  if (team !== 'A' && team !== 'B') throw new Error('INVALID_TEAM');
}

function nextStake(stake: Stake): Stake {
  const next = STAKES[STAKES.indexOf(stake) + 1];
  if (next === undefined) throw new Error('MAXIMUM_STAKE');
  return next;
}

function assertBetting(state: BettingState): void {
  if (
    !STAKES.includes(state.acceptedStake) ||
    (state.lastRaisingTeam !== null &&
      state.lastRaisingTeam !== 'A' &&
      state.lastRaisingTeam !== 'B')
  ) {
    throw new Error('INVALID_BETTING_STATE');
  }
  if (state.pendingStake === null) {
    if (
      state.resumeTurnSeat !== null ||
      (state.acceptedStake === 1) !== (state.lastRaisingTeam === null)
    ) {
      throw new Error('INVALID_BETTING_STATE');
    }
    return;
  }
  if (
    state.acceptedStake === 12 ||
    state.pendingStake !== STAKES[STAKES.indexOf(state.acceptedStake) + 1] ||
    state.lastRaisingTeam === null ||
    state.resumeTurnSeat === null ||
    !Number.isInteger(state.resumeTurnSeat) ||
    state.resumeTurnSeat < 0 ||
    state.resumeTurnSeat > 3
  ) {
    throw new Error('INVALID_BETTING_STATE');
  }
}

export function createBetting(): BettingState {
  return {
    acceptedStake: 1,
    pendingStake: null,
    lastRaisingTeam: null,
    resumeTurnSeat: null,
  };
}

/** The match validates phase, seat ownership and the current turn before this transition. */
export function requestRaise(state: BettingState, team: Team, turnSeat: number): BettingState {
  assertBetting(state);
  assertTeam(team);
  if (!Number.isInteger(turnSeat) || turnSeat < 0 || turnSeat > 3) {
    throw new Error('INVALID_SEAT');
  }
  if ((turnSeat % 2 === 0 ? 'A' : 'B') !== team) throw new Error('INVALID_TEAM_SEAT');
  if (state.pendingStake !== null) throw new Error('RAISE_ALREADY_PENDING');
  if (state.lastRaisingTeam === team) throw new Error('TEAM_CANNOT_RAISE');
  return {
    acceptedStake: state.acceptedStake,
    pendingStake: nextStake(state.acceptedStake),
    lastRaisingTeam: team,
    resumeTurnSeat: turnSeat,
  };
}

/** A counter-raise accepts the previous offer before proposing the next level. */
export function respondRaise(
  state: BettingState,
  team: Team,
  response: RaiseResponse,
): BettingResult {
  assertBetting(state);
  assertTeam(team);
  if (response !== 'accept' && response !== 'raise' && response !== 'fold') {
    throw new Error('INVALID_RAISE_RESPONSE');
  }
  if (state.pendingStake === null || state.lastRaisingTeam === null) {
    throw new Error('NO_PENDING_RAISE');
  }
  if (state.lastRaisingTeam === team) throw new Error('TEAM_CANNOT_RESPOND');
  if (response === 'fold') {
    return { kind: 'fold', winner: state.lastRaisingTeam, reward: state.acceptedStake };
  }
  if (response === 'accept') {
    return {
      kind: 'continue',
      betting: {
        ...state,
        acceptedStake: state.pendingStake,
        pendingStake: null,
        resumeTurnSeat: null,
      },
    };
  }
  return {
    kind: 'continue',
    betting: {
      ...state,
      acceptedStake: state.pendingStake,
      pendingStake: nextStake(state.pendingStake),
      lastRaisingTeam: team,
    },
  };
}
