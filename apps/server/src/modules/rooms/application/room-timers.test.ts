import { expect, test } from 'bun:test';
import { cardKey, cardStrength } from '@truco/game-core/cards';
import { defaultRoomConfig } from '@truco/game-protocol';
import { actor, fixture, giveOneToA, playTurn, start } from './room-service.test';

test('deadline auto-plays the weakest own card and rejects a command arriving at that boundary', async () => {
  const f = fixture();
  try {
    const r = await f.room();
    await start(r);
    const state = r.host.view.match;
    if (state?.phase.type !== 'TURN') throw new Error('NO_TURN');
    const p = actor(r, state.phase.seat);
    const own = p.view.match?.hand.hands.find((hand) => hand.seat === p.view.selfSeat);
    if (own?.visibility !== 'visible') throw new Error('NO_CARDS');
    const expected = [...own.cards].sort(
      (a, b) =>
        cardStrength(a, state.hand.vira) - cardStrength(b, state.hand.vira) ||
        cardKey(a).localeCompare(cardKey(b), 'en'),
    )[0];
    const late = p.message({ type: 'REQUEST_RAISE' });
    const deadline = p.view.deadline;
    if (deadline === null) throw new Error('NO_DEADLINE');
    f.setNow(deadline);
    expect(await p.raw(late)).toMatchObject({ code: 'STALE_CONTEXT' });
    expect(p.view.match?.hand.plays[0]).toMatchObject({
      seat: p.view.selfSeat,
      covered: false,
      card: expected,
    });
  } finally {
    f.service.close();
  }
});

test('raise response timeout folds at accepted value and eleven timeout awards exactly one', async () => {
  const f = fixture();
  try {
    const r = await f.room();
    await start(r);
    const phase = r.host.view.match?.phase;
    if (phase?.type !== 'TURN') throw new Error('NO_TURN');
    const raiser = actor(r, phase.seat);
    await raiser.send({ type: 'REQUEST_RAISE' });
    const deadline = raiser.view.deadline;
    if (deadline === null) throw new Error('NO_DEADLINE');
    await f.advance(deadline);
    const team = phase.seat % 2 === 0 ? 'A' : 'B';
    expect(raiser.view.match?.score[team]).toBe(1);
    while ((r.host.view.match?.score.A ?? 0) < 11) await giveOneToA(r);
    expect(r.host.view.match?.phase.type).toBe('ELEVEN_DECISION');
    const beforeB = r.host.view.match?.score.B ?? 0;
    const elevenDeadline = r.host.view.deadline;
    if (elevenDeadline === null) throw new Error('NO_DEADLINE');
    await f.advance(elevenDeadline);
    expect(r.host.view.match?.score.A).toBe(11);
    expect(r.host.view.match?.score.B).toBe(beforeB + 1);
    expect((await actor(r, 0).send({ type: 'DECIDE_ELEVEN', response: 'play' })).type).toBe('ACK');
    expect(r.host.view.match?.phase.type).toBe('TURN');
  } finally {
    f.service.close();
  }
});

test('reconnection preserves remaining time and cumulatively spends protection instead of recharging', async () => {
  const f = fixture();
  try {
    const r = await f.room();
    await start(r);
    const phase = r.host.view.match?.phase;
    if (phase?.type !== 'TURN') throw new Error('NO_TURN');
    const p = actor(r, phase.seat);
    f.setNow(200);
    await p.disconnect();
    expect(actor(r, (phase.seat + 1) % 2).view.paused).toBe(true);
    f.setNow(10200);
    await p.connect(r.code);
    expect(p.view.deadline).toBe(11000);
    f.setNow(10300);
    await p.disconnect();
    await f.advance(60300);
    const spectator = actor(r, (phase.seat + 1) % 2);
    expect(spectator.view.paused).toBe(false);
    expect(spectator.view.deadline).toBe(61000);
    await f.advance(61000);
    expect(spectator.view.match?.hand.plays).toHaveLength(1);
  } finally {
    f.service.close();
  }
});

test('a connected partner can answer without pausing or revealing additional private cards', async () => {
  const f = fixture();
  try {
    const r = await f.room({ ...defaultRoomConfig, format: '2v2' });
    await start(r);
    const phase = r.host.view.match?.phase;
    if (phase?.type !== 'TURN') throw new Error('NO_TURN');
    await actor(r, phase.seat).send({ type: 'REQUEST_RAISE' });
    const responseSeat = phase.seat % 2 === 0 ? 1 : 0;
    await actor(r, responseSeat).disconnect();
    const partner = actor(r, responseSeat + 2);
    expect(partner.view.paused).toBe(false);
    expect((await partner.send({ type: 'RESPOND_RAISE', response: 'accept' })).type).toBe('ACK');
    expect(
      partner.view.match?.hand.hands.filter((hand) => hand.visibility === 'visible'),
    ).toHaveLength(1);
  } finally {
    f.service.close();
  }
});

test('cancelled pre-pause callbacks cannot expire resumed turns or permit actions during protection', async () => {
  const f = fixture();
  try {
    const r = await f.room();
    await start(r);
    const phase = r.host.view.match?.phase;
    if (phase?.type !== 'TURN') throw new Error('NO_TURN');
    const p = actor(r, phase.seat);
    const other = actor(r, (phase.seat + 1) % 2);
    const old = f.timers.at(-1);
    f.setNow(200);
    await p.disconnect();
    expect(await other.send({ type: 'REQUEST_RAISE' })).toMatchObject({ code: 'DECISION_PAUSED' });
    f.setNow(700);
    await p.connect(r.code);
    expect(p.view.deadline).toBe(1500);
    const decision = p.view.decisionId;
    f.setNow(1000);
    old?.callback();
    await p.send({ type: 'SYNC' });
    expect(p.view.decisionId).toBe(decision);
    expect(p.view.match?.revision).toBe(0);
    expect(p.view.deadline).toBe(1500);
    await f.advance(1500);
    expect(other.view.match?.hand.plays).toHaveLength(1);
  } finally {
    f.service.close();
  }
});

test('three consecutive required decisions expire into abandonment, while valid actions reset the streak', async () => {
  for (const reset of [false, true]) {
    const f = fixture();
    try {
      const r = await f.room();
      await start(r);
      const phase = r.host.view.match?.phase;
      if (phase?.type !== 'TURN') throw new Error('NO_TURN');
      const target = phase.seat;
      let expired = 0;
      let resetDone = false;
      for (let action = 0; action < 60 && r.host.view.status === 'playing'; action++) {
        const current = r.host.view.match?.phase;
        if (current?.type !== 'TURN') throw new Error('NO_TURN');
        if (current.seat === target && (!reset || expired !== 2 || resetDone)) {
          const deadline = r.host.view.deadline;
          if (deadline === null) throw new Error('NO_DEADLINE');
          await f.advance(deadline);
          expired++;
        } else {
          await playTurn(r);
          if (current.seat === target) {
            resetDone = true;
            expired = 0;
          }
        }
        if (resetDone && expired === 2) break;
      }
      if (reset) {
        expect(resetDone).toBe(true);
        expect(r.host.view.status).toBe('playing');
      } else
        expect(r.host.view.outcome).toEqual({
          winner: target % 2 === 0 ? 'B' : 'A',
          reason: 'abandonment',
        });
    } finally {
      f.service.close();
    }
  }
});

test('empty rooms expire without winner and untimed turns only fallback after absent protection', async () => {
  const f = fixture();
  try {
    const r = await f.room({ ...defaultRoomConfig, cardTimeoutMs: null });
    await start(r);
    await f.advance(100000);
    expect(r.host.view.match?.revision).toBe(0);
    const phase = r.host.view.match?.phase;
    if (phase?.type !== 'TURN') throw new Error('NO_TURN');
    await actor(r, phase.seat).disconnect();
    await f.advance(160000);
    const other = actor(r, (phase.seat + 1) % 2);
    expect(other.view.match?.hand.plays).toHaveLength(1);
    await other.disconnect();
    await f.advance(220000);
    await expect(f.service.join(r.code, 'new', 'Novo')).rejects.toThrow('ROOM_NOT_FOUND');
    await expect(other.connect(r.code)).rejects.toThrow('ROOM_NOT_FOUND');
  } finally {
    f.service.close();
  }
});

test('new untimed decisions for an absent seat with spent protection still auto-play and eventually abandon', async () => {
  const f = fixture();
  try {
    const r = await f.room({ ...defaultRoomConfig, cardTimeoutMs: null });
    await start(r);
    const phase = r.host.view.match?.phase;
    if (phase?.type !== 'TURN') throw new Error('NO_TURN');
    const absent = actor(r, phase.seat);
    const present = actor(r, (phase.seat + 1) % 2);
    await absent.disconnect();
    // Continue observing through the connected recipient; disconnected snapshots stop updating.
    r.host = present;
    await f.advance(60000);
    for (let step = 0; step < 20 && present.view.status === 'playing'; step++) {
      const current = present.view.match?.phase;
      if (current?.type !== 'TURN') throw new Error('NO_TURN');
      if (current.seat === present.view.selfSeat) await playTurn(r);
      await f.advance(60001 + step);
    }
    expect(present.view.outcome).toEqual({
      winner: phase.seat % 2 === 0 ? 'B' : 'A',
      reason: 'abandonment',
    });
  } finally {
    f.service.close();
  }
});
