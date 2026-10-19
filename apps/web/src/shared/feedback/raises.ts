import type { RoomView } from '@truco/game-protocol';

export type RaiseStake = 3 | 6 | 9 | 12;

export function nextRaise(stake: number): RaiseStake | null {
  if (stake === 1) return 3;
  if (stake === 3) return 6;
  if (stake === 6) return 9;
  if (stake === 9) return 12;
  return null;
}

/** Only a fresh authoritative proposal is a shout, never a restored negotiation. */
export function confirmedRaise(previous: RoomView, room: RoomView): RaiseStake | null {
  const stake = room.match?.hand.betting.pendingStake;
  if (
    room.code !== previous.code ||
    room.matchId !== previous.matchId ||
    room.matchId === null ||
    room.sequence !== previous.sequence + 1 ||
    previous.status !== 'playing' ||
    room.status !== 'playing' ||
    previous.paused ||
    room.paused ||
    room.transition ||
    room.match?.phase.type !== 'RAISE_RESPONSE' ||
    previous.match?.hand.number !== room.match.hand.number ||
    previous.match.hand.betting.pendingStake === stake ||
    (stake !== 3 && stake !== 6 && stake !== 9 && stake !== 12)
  )
    return null;

  return stake;
}

/** Acceptance must settle exactly the pending proposal in the same live hand. */
export function confirmedAcceptance(previous: RoomView, room: RoomView): RaiseStake | null {
  const stake = previous.match?.hand.betting.pendingStake;
  if (
    room.code !== previous.code ||
    room.matchId !== previous.matchId ||
    room.matchId === null ||
    room.sequence !== previous.sequence + 1 ||
    previous.status !== 'playing' ||
    room.status !== 'playing' ||
    previous.paused ||
    room.paused ||
    room.transition ||
    previous.match?.phase.type !== 'RAISE_RESPONSE' ||
    room.match?.phase.type !== 'TURN' ||
    previous.match.hand.number !== room.match.hand.number ||
    room.match.hand.betting.pendingStake !== null ||
    room.match.hand.betting.acceptedStake !== stake ||
    (stake !== 3 && stake !== 6 && stake !== 9 && stake !== 12)
  )
    return null;

  return stake;
}
