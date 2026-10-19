import { expect, test } from 'bun:test';
import { defaultRoomConfig, type RoomView } from '@truco/game-protocol';
import { confirmedAcceptance, confirmedRaise, nextRaise, type RaiseStake } from './raises';
import { RoomAudioEvents } from './events';

export function raiseRoom(stake: RaiseStake | null = null, sequence = 1): RoomView {
  return {
    code: 'ABC123',
    sequence,
    roomRevision: 0,
    status: 'playing',
    hostSeat: 0,
    selfSeat: 0,
    seats: [],
    config: defaultRoomConfig,
    matchId: 'm1',
    decisionId: `d${sequence}`,
    deadline: null,
    paused: false,
    outcome: null,
    match: {
      seat: 0,
      playerCount: 2,
      revision: sequence,
      score: { A: 0, B: 0 },
      phase: stake ? { type: 'RAISE_RESPONSE' } : { type: 'TURN', seat: 1 },
      hand: {
        number: 1,
        kind: 'normal',
        leader: 0,
        elevenTeam: null,
        trickLeader: 0,
        vira: { rank: '4', suit: 'clubs' },
        hands: [],
        plays: [],
        completedTricks: [],
        betting: {
          acceptedStake: 1,
          pendingStake: stake,
          lastRaisingTeam: stake ? 'A' : null,
          resumeTurnSeat: null,
        },
      },
    },
  };
}

test('raise progression has no skipped level or proposal above twelve', () => {
  expect([1, 3, 6, 9, 12, 0].map(nextRaise)).toEqual([3, 6, 9, 12, null, null]);
});

test('each confirmed proposal has a distinct sound; sync, restore and rejected commands remain silent', () => {
  const audio = new RoomAudioEvents();
  let previous = raiseRoom();
  expect(audio.observe(previous)).toEqual([]);
  for (const [index, stake] of ([3, 6, 9, 12] as const).entries()) {
    const current = raiseRoom(stake, previous.sequence + 1);
    expect(confirmedRaise(previous, current)).toBe(stake);
    expect(audio.observe(current)).toEqual([
      (['truco', 'six', 'nine', 'twelve'] as const)[index] ?? 'truco',
    ]);
    expect(audio.observe(current)).toEqual([]);
    const sync = { ...current, sequence: current.sequence + 1 };
    expect(audio.observe(sync)).toEqual([]);
    previous = sync;
  }
  audio.reset();
  expect(audio.observe(previous)).toEqual([]);
});

test('paused, new hand, changed room/match, nonconsecutive and nonplaying snapshots cannot announce raises', () => {
  const previous = raiseRoom();
  const current = raiseRoom(3, 2);
  const variants: RoomView[] = [
    { ...current, code: 'OTHER1' },
    { ...current, matchId: 'other' },
    { ...current, matchId: null },
    { ...current, sequence: 4 },
    { ...current, paused: true },
    { ...current, status: 'finished' },
    { ...current, transition: { id: 'deal', kind: 'deal', until: 1 } },
    { ...current, match: null },
    raiseRoom(null, 2),
  ];
  for (const room of variants) expect(confirmedRaise(previous, room)).toBeNull();
  expect(confirmedRaise({ ...previous, paused: true }, current)).toBeNull();
  expect(confirmedRaise({ ...previous, status: 'lobby' }, current)).toBeNull();
  expect(confirmedRaise(raiseRoom(3), current)).toBeNull();
  const changedHand = structuredClone(current);
  if (!changedHand.match) throw new Error('MISSING_MATCH');
  changedHand.match.hand.number = 2;
  expect(confirmedRaise(previous, changedHand)).toBeNull();
});

export function acceptedRoom(stake: RaiseStake = 3, sequence = 2): RoomView {
  const room = raiseRoom(null, sequence);
  if (!room.match) throw new Error('MISSING_MATCH');
  room.match.hand.betting.acceptedStake = stake;
  return room;
}

test('acceptance announces the settled value once, never a refusal, restore or implicit counter-raise', () => {
  for (const stake of [3, 6, 9, 12] as const) {
    const previous = raiseRoom(stake);
    const current = acceptedRoom(stake);
    expect(confirmedAcceptance(previous, current)).toBe(stake);
    const audio = new RoomAudioEvents();
    expect(audio.observe(previous)).toEqual([]);
    expect(audio.observe(current)).toEqual(['acceptRaise']);
    expect(audio.observe(current)).toEqual([]);
    audio.reset();
    expect(audio.observe(current)).toEqual([]);
    const variants: RoomView[] = [
      { ...current, code: 'OTHER1' },
      { ...current, matchId: 'other' },
      { ...current, matchId: null },
      { ...current, sequence: 4 },
      { ...current, paused: true },
      { ...current, status: 'finished' },
      { ...current, transition: { id: 'deal', kind: 'deal', until: 1 } },
      { ...current, match: null },
      raiseRoom(null, 2),
      raiseRoom(6, 2),
    ];
    for (const room of variants) expect(confirmedAcceptance(previous, room)).toBeNull();
    expect(confirmedAcceptance({ ...previous, paused: true }, current)).toBeNull();
    expect(confirmedAcceptance({ ...previous, status: 'lobby' }, current)).toBeNull();
    expect(confirmedAcceptance(raiseRoom(), current)).toBeNull();
    const nextHand = structuredClone(current);
    if (!nextHand.match) throw new Error('MISSING_MATCH');
    nextHand.match.hand.number++;
    expect(confirmedAcceptance(previous, nextHand)).toBeNull();
  }
});
