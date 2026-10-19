import { expect, test } from 'bun:test';
import { defaultRoomConfig, type RoomView } from '@truco/game-protocol';
import { interactionSound, RoomAudioEvents } from './events';

function room(): RoomView {
  return {
    code: 'ABC123',
    sequence: 1,
    roomRevision: 0,
    status: 'playing',
    hostSeat: 0,
    selfSeat: 0,
    seats: [],
    config: defaultRoomConfig,
    matchId: 'match_one',
    decisionId: 'decision_one',
    deadline: null,
    paused: false,
    outcome: null,
    match: {
      seat: 0,
      playerCount: 2,
      revision: 1,
      score: { A: 0, B: 0 },
      phase: { type: 'TURN', seat: 1 },
      powers: { players: [], activations: [] },
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
          pendingStake: null,
          lastRaisingTeam: null,
          resumeTurnSeat: null,
        },
      },
    },
  };
}

function next(previous: RoomView, changes: Partial<RoomView> = {}): RoomView {
  return { ...structuredClone(previous), sequence: previous.sequence + 1, ...changes };
}

test('first snapshot, repeated SYNC, reconnect and gaps never replay sounds', () => {
  const events = new RoomAudioEvents();
  const first = room();
  expect(events.observe(first)).toEqual([]);
  expect(events.observe(first)).toEqual([]);
  expect(events.observe(next(first))).toEqual([]);
  expect(events.observe(next(first, { sequence: 6 }))).toEqual([]);
  events.reset();
  expect(events.observe(next(first, { sequence: 7 }))).toEqual([]);
  expect(events.observe(next(first, { sequence: 8, code: 'ZZZ999' }))).toEqual([]);
});

test('deal, resolved trick, hand result and reopened own turn follow confirmed server state', () => {
  const events = new RoomAudioEvents();
  const first = room();
  events.observe({ ...first, match: null, matchId: null, status: 'lobby' });
  let view = next(first);
  expect(events.observe(view)).toEqual(['deal']);
  view = next(view);
  if (!view.match) throw new Error('match');
  view.match.revision++;
  view.match.hand.completedTricks = [
    { leader: 0, plays: [], result: { winner: 'A', nextLeader: 0 } },
  ];
  view.transition = { id: 'transition_one', kind: 'trick', until: 100 };
  view.decisionId = null;
  view.match.phase = { type: 'TURN', seat: 0 };
  expect(events.observe(view)).toEqual(['win']);
  view = next(view);
  expect(events.observe(view)).toEqual([]);
  view = next(view, { transition: undefined, decisionId: 'decision_two' });
  expect(events.observe(view)).toEqual(['turn']);
  view = next(view);
  if (!view.match) throw new Error('match');
  view.match.revision++;
  view.match.phase = { type: 'HAND_END', winner: 'A', reward: 1 };
  expect(events.observe(view)).toEqual(['win']);
  view = next(view, { transition: { id: 'transition_deal', kind: 'deal', until: 200 } });
  if (!view.match) throw new Error('match');
  view.match.revision++;
  view.match.hand.number++;
  view.match.hand.completedTricks = [];
  view.match.phase = { type: 'TURN', seat: 0 };
  expect(events.observe(view)).toEqual(['deal']);
  view = next(view, { transition: undefined, decisionId: 'decision_three' });
  expect(events.observe(view)).toEqual(['turn']);
  view = next(view, { status: 'finished' });
  if (!view.match) throw new Error('match');
  view.match.revision++;
  view.match.phase = { type: 'MATCH_END', winner: 'A' };
  expect(events.observe(view)).toEqual(['matchWin']);
});

test('only disclosed activations make power cues, never assignment or readiness', () => {
  const events = new RoomAudioEvents();
  let view = room();
  events.observe(view);
  view = next(view);
  if (!view.match) throw new Error('match');
  view.match.revision++;
  view.match.powers = {
    players: [{ seat: 1, power: null, energy: 2, used: false, ready: true }],
    activations: [],
  };
  expect(events.observe(view)).toEqual([]);
  view = next(view);
  if (!view.match?.powers) throw new Error('powers');
  view.match.revision++;
  view.match.powers.activations = [{ seat: 1, power: 'spy', target: 0 }];
  expect(events.observe(view)).toEqual(['power']);
  view = next(view);
  expect(events.observe(view)).toEqual([]);
  const older = next(view);
  if (!older.match) throw new Error('match');
  older.match.revision = 0;
  expect(events.observe(older)).toEqual([]);
  expect(events.observe(next(older, { matchId: 'other_match' }))).toEqual([]);
  expect(events.observe(next(older, { sequence: older.sequence + 2, match: null }))).toEqual([]);
});

test('turn cue requires own unpaused decision and supports resume with same decision', () => {
  const events = new RoomAudioEvents();
  let view = room();
  events.observe(view);
  view = next(view, { paused: true, decisionId: 'next_decision' });
  if (!view.match) throw new Error('match');
  view.match.phase = { type: 'TURN', seat: 0 };
  expect(events.observe(view)).toEqual([]);
  view = next(view, { paused: false });
  expect(events.observe(view)).toEqual(['turn']);
  view = next(view);
  expect(events.observe(view)).toEqual([]);
  view = next(view, { decisionId: 'opponent_decision' });
  if (!view.match) throw new Error('match');
  view.match.phase = { type: 'TURN', seat: 1 };
  expect(events.observe(view)).toEqual([]);
});

test('delegated UI cues distinguish cards, menus and clicks without activating power sounds', () => {
  const host = document.createElement('div');
  host.innerHTML =
    '<button><span>click</span></button><button class="card">card</button><button class="power-card">power</button><details><summary>menu</summary></details><button disabled>blocked</button><div aria-disabled="true"><button>offline</button></div><div data-audio-controls><button>mute</button></div><div>plain</div><nav class="main-menu"><button>join</button></nav>';
  const button = host.querySelector('button');
  expect(interactionSound(button?.firstChild ?? null)).toBe('click');
  expect(interactionSound(host.querySelector('.card'))).toBe('select');
  expect(interactionSound(host.querySelector('.power-card'))).toBe('select');
  expect(interactionSound(host.querySelector('summary'))).toBe('menu');
  expect(interactionSound(host.querySelector(':disabled'))).toBeNull();
  expect(interactionSound(host.querySelector('[aria-disabled] button'))).toBeNull();
  expect(interactionSound(host.querySelector('[data-audio-controls] button'))).toBeNull();
  expect(interactionSound(host.querySelector('.main-menu button'))).toBe('menu');
  expect(interactionSound(host.querySelector('div'))).toBeNull();
  expect(interactionSound(document.createTextNode('text'))).toBeNull();
  expect(interactionSound(null)).toBeNull();
});

for (const playerCount of [2, 4] as const) {
  test(`${playerCount} players hear victory or defeat for their own alternating team`, () => {
    for (const selfSeat of [0, 1, 2, 3] as const) {
      if (selfSeat >= playerCount) continue;
      for (const winner of ['A', 'B'] as const) {
        for (const resolution of ['trick', 'hand', 'match'] as const) {
          const events = new RoomAudioEvents();
          const first = room();
          first.selfSeat = selfSeat;
          if (!first.match) throw new Error('match');
          first.match.playerCount = playerCount;
          first.match.seat = first.selfSeat;
          events.observe(first);
          const resolved = next(first, { decisionId: null });
          if (!resolved.match) throw new Error('match');
          resolved.match.revision++;
          resolved.match.hand.completedTricks = [
            { leader: 0, plays: [], result: { winner, nextLeader: 0 } },
          ];
          if (resolution === 'hand') resolved.match.phase = { type: 'HAND_END', winner, reward: 1 };
          if (resolution === 'match') {
            resolved.status = 'finished';
            resolved.outcome = { winner, reason: 'completed' };
            resolved.match.phase = { type: 'MATCH_END', winner };
            resolved.match.score[winner] = 12;
          }
          const ownTeam = selfSeat % 2 === 0 ? 'A' : 'B';
          const won = ownTeam === winner;
          const expected =
            resolution === 'match' ? (won ? 'matchWin' : 'matchLose') : won ? 'win' : 'lose';
          expect(events.observe(resolved)).toEqual([expected]);
          expect(events.observe(resolved)).toEqual([]);
          const timerSnapshot = next(resolved, { transition: undefined });
          expect(events.observe(timerSnapshot)).toEqual([]);
          events.reset();
          expect(events.observe(next(timerSnapshot))).toEqual([]);
        }
      }
    }
  });
}

test('hand and final results take priority over the simultaneously resolved trick', () => {
  const events = new RoomAudioEvents();
  const first = room();
  events.observe(first);
  const resolved = next(first);
  if (!resolved.match) throw new Error('match');
  resolved.match.hand.completedTricks = [
    { leader: 0, plays: [], result: { winner: 'A', nextLeader: 0 } },
  ];
  resolved.match.phase = { type: 'HAND_END', winner: 'B', reward: 1 };
  expect(events.observe(resolved)).toEqual(['lose']);
  const finished = next(resolved, {
    status: 'finished',
    outcome: { winner: 'B', reason: 'completed' },
  });
  if (!finished.match) throw new Error('match');
  finished.match.phase = { type: 'MATCH_END', winner: 'B' };
  finished.match.hand.completedTricks = [
    ...finished.match.hand.completedTricks,
    { leader: 0, plays: [], result: { winner: 'A', nextLeader: 0 } },
  ];
  expect(events.observe(finished)).toEqual(['matchLose']);
  expect(events.observe(next(finished))).toEqual([]);
});

test('drawn tricks, drawn hands and neutral endings have a neutral cue', () => {
  const events = new RoomAudioEvents();
  const first = room();
  events.observe(first);
  const trick = next(first, { decisionId: null });
  if (!trick.match) throw new Error('match');
  trick.match.hand.completedTricks = [
    { leader: 0, plays: [], result: { winner: 'tie', nextLeader: 0 } },
  ];
  expect(events.observe(trick)).toEqual(['tie']);
  const hand = next(trick);
  if (!hand.match) throw new Error('match');
  hand.match.phase = { type: 'HAND_END', winner: 'tie', reward: 0 };
  expect(events.observe(hand)).toEqual(['tie']);
  const finished = next(hand, {
    status: 'finished',
    outcome: { winner: null, reason: 'technical' },
  });
  expect(events.observe(finished)).toEqual(['tie']);
  expect(events.observe(next(finished))).toEqual([]);
});

test('folds and eleven decisions use the confirmed hand winner without inventing a trick', () => {
  for (const winner of ['A', 'B'] as const) {
    for (const phase of [
      { type: 'RAISE_RESPONSE' },
      { type: 'ELEVEN_DECISION', team: 'A' },
    ] as const) {
      const events = new RoomAudioEvents();
      const first = room();
      if (!first.match) throw new Error('match');
      first.match.phase = phase;
      events.observe(first);
      const hand = next(first);
      if (!hand.match) throw new Error('match');
      hand.match.phase = { type: 'HAND_END', winner, reward: 3 };
      expect(events.observe(hand)).toEqual([winner === 'A' ? 'win' : 'lose']);
      expect(hand.match.hand.completedTricks).toEqual([]);
    }
  }
});

test('surrender and abandonment use the public outcome and cannot replay after final metadata arrives', () => {
  for (const reason of ['surrender', 'abandonment'] as const) {
    const events = new RoomAudioEvents();
    const first = room();
    events.observe(first);
    const ended = next(first, { status: 'finished', outcome: { winner: 'B', reason } });
    expect(events.observe(ended)).toEqual(['matchLose']);
    const again = next(ended);
    if (!again.match) throw new Error('match');
    again.match.phase = { type: 'MATCH_END', winner: 'B' };
    expect(events.observe(again)).toEqual([]);
  }
  const events = new RoomAudioEvents();
  const lobby = { ...room(), match: null, matchId: null, status: 'lobby' as const };
  events.observe(lobby);
  expect(events.observe(next(room(), { status: 'finished' }))).toEqual([]);
});
