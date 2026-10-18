import { startMatch, executeCommand } from '../src/match/match';
import type { MatchState, PlayerCommand } from '../src/match/types';
import type { PowerSetup, PreparationIntent } from '../src/powers/powers';

export const shuffle = Array.from({ length: 39 }, (_, i) => 39 - i);
export function setup(draws = [0, 1, 0, 1], preset: PowerSetup['preset'] = 'casual'): PowerSetup {
  return { preset, draws, flips: [0, 1], spies: draws.map(() => 2) };
}
export function begin(draws = [0, 1, 0, 1], leader = 0) {
  return startMatch(draws.length === 2 ? 2 : 4, leader, shuffle, setup(draws)).state;
}
export function act(state: MatchState, seat: number, command: PlayerCommand) {
  return executeCommand(state, state.revision, seat, command).state;
}
export function commit(state: MatchState, seat: number, intent: PreparationIntent) {
  return act(state, seat, { type: 'PREPARE', intent });
}
export function passAll(state: MatchState) {
  for (let seat = 0; seat < state.playerCount; seat++)
    state = commit(state, seat, { type: 'pass' });
  return state;
}
export function card(state: MatchState, seat: number, index = 0) {
  const value = state.hand.hands[seat]?.[index];
  if (!value) throw new Error('MISSING_CARD');
  return value;
}
